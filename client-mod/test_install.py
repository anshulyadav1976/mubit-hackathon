import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("installer", Path(__file__).with_name("install-prism.py"))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallTest(unittest.TestCase):
    def test_preserves_login_options_worlds_and_unrelated_mods(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); module = root / "client"; instance = root / "EVERAFTER"
            mods = instance / ".minecraft/mods"; mods.mkdir(parents=True)
            (instance / "mmc-pack.json").write_text(json.dumps({"formatVersion": 1, "components": [{"uid": "net.minecraft", "version": "1.21.11"}]}))
            (instance / ".minecraft/options.txt").write_text("keep my settings")
            (instance / ".minecraft/worlds").mkdir()
            (mods / "unrelated.jar").write_bytes(b"keep")
            (mods / "everafter-client-old.jar").write_bytes(b"previous")
            jar = module / "build/libs/everafter-client-1.0.0.jar"; jar.parent.mkdir(parents=True); jar.write_bytes(b"client")
            api = module / ".tooling" / ("fabric-api-" + installer.API + ".jar"); api.parent.mkdir(); api.write_bytes(b"api")
            metadata = json.dumps({"uid": "net.fabricmc.fabric-loader", "version": installer.LOADER}).encode()
            with patch.object(installer, "MODULE", module), patch.object(installer, "API_SHA512", hashlib.sha512(b"api").hexdigest()), \
                    patch.object(installer.subprocess, "check_output", return_value=""), \
                    patch.object(installer.urllib.request, "urlopen", return_value=io.BytesIO(metadata)), contextlib.redirect_stdout(io.StringIO()):
                installer.install(instance)
            self.assertEqual((instance / ".minecraft/options.txt").read_text(), "keep my settings")
            self.assertTrue((instance / ".minecraft/worlds").is_dir())
            self.assertEqual((mods / "unrelated.jar").read_bytes(), b"keep")
            self.assertEqual((mods / jar.name).read_bytes(), b"client")
            backups = list((instance / "everafter-backups").iterdir())
            self.assertEqual((backups[0] / "everafter-client-old.jar").read_bytes(), b"previous")
            parts = json.loads((instance / "mmc-pack.json").read_text())["components"]
            self.assertIn({"uid": "net.fabricmc.fabric-loader", "version": installer.LOADER}, parts)

    def test_refuses_live_minecraft_before_touching_instance(self):
        with patch.object(installer.subprocess, "check_output", return_value="java org.prismlauncher.EntryPoint"):
            with self.assertRaisesRegex(RuntimeError, "Close Minecraft"):
                installer.install(Path("/no/instance/files/touched"))


if __name__ == "__main__":
    unittest.main()
