"""No real service is started, stopped, or contacted by these tests."""
import contextlib
import io
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import lifecycle as app


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.server = self.root / "runtime/server"
        self.pids = self.root / "runtime/services"
        self.server.mkdir(parents=True)
        self.pids.mkdir(parents=True)
        for name, value in {"ROOT": self.root, "SERVER": self.server, "PIDS": self.pids,
                            "LOGS": self.root / "runtime/logs"}.items():
            change = patch.object(app, name, value)
            change.start()
            self.addCleanup(change.stop)

    def record(self, service="server"):
        record = {"root": str(self.root), "service": service, "pid": 987654,
                  "started": "Saturday original", "executable": "/our/java"}
        (self.pids / (service + ".json")).write_text(json.dumps(record))
        return record

    def test_properties_enforce_loopback_online_auth_and_valid_flat_layers(self):
        path = self.server / "server.properties"
        path.write_text("server-ip=0.0.0.0\nonline-mode=false\ngenerator-settings={}\ncustom=value\n")
        app.write_properties()
        values = dict(line.split("=", 1) for line in path.read_text().splitlines())
        self.assertEqual(values["server-ip"], "127.0.0.1")
        self.assertEqual(values["online-mode"], "true")
        self.assertEqual(values["management-server-enabled"], "false")
        self.assertEqual(values["custom"], "value")
        self.assertEqual(sum(layer["height"] for layer in json.loads(values["generator-settings"])["layers"]), 65)

    def test_port_probe_allows_time_wait_without_accepting_an_active_listener(self):
        with socket.socket() as listener:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            port = listener.getsockname()[1]
            self.assertFalse(app.port_free(port))
            with socket.create_connection(("127.0.0.1", port)) as client:
                connection, _ = listener.accept()
                with connection:
                    connection.shutdown(socket.SHUT_WR)
                    self.assertEqual(client.recv(1), b"")
        self.assertTrue(app.port_free(port), "A closed listener's TIME_WAIT sockets must not block restart")

    def test_reused_pid_is_never_signaled(self):
        self.record()
        with patch.object(app, "process_info", return_value={"started": "Monday reused", "command": "/our/java -jar paper.jar"}), \
                patch.object(app, "process_cwd", return_value=self.server), patch.object(app.os, "kill") as kill:
            with self.assertRaisesRegex(RuntimeError, "identity changed"):
                app.stop()
            kill.assert_not_called()

    def test_process_identity_is_read_by_one_ps_snapshot(self):
        snapshot = "S Sat Oct 24 15:01:00 2026 /our/java -jar paper.jar"
        with patch.object(app, "text_command", return_value=snapshot) as command:
            self.assertEqual(app.process_info(987654), {"started": "Sat Oct 24 15:01:00 2026", "command": "/our/java -jar paper.jar"})
            command.assert_called_once_with(["ps", "-p", "987654", "-o", "stat=,lstart=,command="])

    def test_process_exit_during_cwd_verification_is_not_a_reused_pid(self):
        record = self.record()
        alive = {"started": "Saturday original", "command": "/our/java -jar paper.jar"}
        with patch.object(app, "process_info", side_effect=[alive, None]), \
                patch.object(app, "process_cwd", return_value=None), patch.object(app.os, "kill") as kill:
            self.assertFalse(app.owned_process("server", record))
            kill.assert_not_called()

    def test_process_exit_immediately_before_sigterm_is_already_stopped(self):
        self.record()
        with patch.object(app, "owned_process", return_value=True), \
                patch.object(app.os, "kill", side_effect=ProcessLookupError):
            app.stop()
        self.assertFalse((self.pids / "server.json").exists())

    def test_wrong_working_directory_is_never_signaled(self):
        self.record()
        with patch.object(app, "process_info", return_value={"started": "Saturday original", "command": "/our/java -jar paper.jar"}), \
                patch.object(app, "process_cwd", return_value=self.root), patch.object(app.os, "kill") as kill:
            with self.assertRaisesRegex(RuntimeError, "identity changed"):
                app.stop()
            kill.assert_not_called()

    def test_stale_pid_file_is_removed_without_signaling(self):
        self.record()
        with patch.object(app, "process_info", return_value=None), patch.object(app.os, "kill") as kill:
            app.stop()
            kill.assert_not_called()
        self.assertFalse((self.pids / "server.json").exists())

    def test_restart_archives_stopped_story_without_deleting_evidence(self):
        directory = self.root / "director/runtime"
        directory.mkdir(parents=True)
        state = directory / "state.json"
        state.write_text('{"conversation":["a memory"]}')
        with patch.object(app, "port_free", return_value=True), contextlib.redirect_stdout(io.StringIO()):
            app.archive_story()
        self.assertFalse(state.exists())
        archives = list(directory.glob("state.*.json"))
        self.assertEqual(len(archives), 1)
        self.assertEqual(json.loads(archives[0].read_text())["conversation"], ["a memory"])

    def test_restart_cannot_archive_state_while_services_are_live(self):
        with patch.object(app, "port_free", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "still occupied"):
                app.archive_story()

    def test_detached_process_has_null_stdin_and_durable_log(self):
        with patch.object(app.subprocess, "Popen") as launch, patch.object(app, "process_info", return_value={"started": "now"}), \
                contextlib.redirect_stdout(io.StringIO()):
            launch.return_value.pid = 987654
            app.spawn("server", ["/our/java", "-Dterminal.jline=false", "-Dterminal.ansi=false", "-jar", "paper.jar"], self.server, {})
        options = launch.call_args.kwargs
        self.assertTrue(options["start_new_session"])
        self.assertTrue(options["close_fds"])
        self.assertEqual(options["stdin"].name, app.os.devnull)
        self.assertEqual(options["cwd"], str(self.server))
        self.assertTrue((app.LOGS / "server.log").exists())

    def test_provider_key_reaches_only_the_director(self):
        (self.server / "paper.jar").write_bytes(b"fixture")
        (self.server / "eula.txt").write_text("eula=true\n")
        artifact = self.root / "plugin/target/everafter.jar"
        artifact.parent.mkdir(parents=True)
        artifact.write_bytes(b"fixture")
        version = subprocess.CompletedProcess([], 0, stdout="", stderr='openjdk version "21.0.13"')
        with patch.dict(app.os.environ, {"MUBIT_API_KEY": "test-only-key"}), \
                patch.object(app, "preflight", return_value=True), \
                patch.object(app.shutil, "which", return_value="/our/node"), \
                patch.object(app, "text_command", side_effect=lambda command: "v22.23.2" if "--version" in command else "--env-file-if-exists"), \
                patch.object(app, "java_home", return_value=self.root / "jdk"), \
                patch.object(app.subprocess, "run", return_value=version) as execute, \
                patch.object(app, "spawn") as spawn, patch.object(app, "wait_port"), \
                contextlib.redirect_stdout(io.StringIO()):
            app.start()
            for call in execute.call_args_list:
                self.assertNotIn("MUBIT_API_KEY", call.kwargs["env"])
            director, server = spawn.call_args_list
            self.assertEqual(director.args[0], "director")
            self.assertEqual(director.args[3]["MUBIT_API_KEY"], "test-only-key")
            self.assertNotIn("MUBIT_API_KEY", server.args[3])
            app.LOGS.mkdir(parents=True)
            with patch.object(app.subprocess, "Popen") as prism:
                app.launch_prism()
                self.assertNotIn("MUBIT_API_KEY", prism.call_args.kwargs["env"])


if __name__ == "__main__":
    unittest.main()
