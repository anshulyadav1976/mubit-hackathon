#!/usr/bin/env python3
"""Local-only launcher. No provider requests or credentials are generated here."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / "runtime"
SERVER = RUNTIME / "server"
TOOLING = ROOT / ".tooling"
PIDS = RUNTIME / "services"
LOGS = RUNTIME / "logs"
SERVICES = ("server", "director")
JAVA_VERSION = "21.0.13+9"
MAVEN_VERSION = "3.9.16"
PAPER_SHA256 = "5ffef465eeeb5f2a3c23a24419d97c51afd7dbb4923ff42df9a3f58bba1ccfba"
MAVEN_SHA512 = "831a8591fe20c8243b1dbe7d71e3244f31d1665b0804b2e825e38cbbe5ce0cafb8338851f90780735568773e0a6cd07bbec107cda0b896b008b861075358b6f6"
FLAT = {"biome": "minecraft:plains", "layers": [
    {"block": "minecraft:bedrock", "height": 1},
    {"block": "minecraft:dirt", "height": 63},
    {"block": "minecraft:grass_block", "height": 1}], "features": False, "lakes": False}


def fail(message):
    raise RuntimeError(message)


def child_environment():
    return {key: value for key, value in os.environ.items() if key not in ("MUBIT_API_KEY", "OPENROUTER_API_KEY")}


def java_home():
    local = TOOLING / ("jdk-" + JAVA_VERSION)
    if (local / "Contents/Home/bin/java").is_file():
        return local / "Contents/Home"
    if (local / "bin/java").is_file():
        return local
    configured = os.environ.get("JAVA_HOME")
    if configured and (Path(configured) / "bin/java").is_file():
        return Path(configured)
    fail("Java 21 is missing. Run ./scripts/setup.sh or set JAVA_HOME.")


def text_command(command):
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=child_environment())
    return result.stdout.strip() if result.returncode == 0 else ""


def process_info(pid):
    if pid < 2 or pid == os.getpid():
        return None
    fields = text_command(["ps", "-p", str(pid), "-o", "stat=,lstart=,command="]).split(None, 6)
    if len(fields) != 7 or fields[0].startswith("Z"):
        return None
    return {"started": " ".join(fields[1:6]), "command": fields[6]}


def process_cwd(pid):
    proc = Path("/proc") / str(pid) / "cwd"
    if proc.exists():
        return proc.resolve()
    lsof = shutil.which("lsof") or "/usr/sbin/lsof"
    output = text_command([lsof, "-a", "-p", str(pid), "-d", "cwd", "-Fn"])
    names = [line[1:] for line in output.splitlines() if line.startswith("n")]
    return Path(names[0]).resolve() if len(names) == 1 else None


def read_record(service):
    path = PIDS / (service + ".json")
    if not path.exists():
        return None
    record = json.loads(path.read_text())
    if record.get("root") != str(ROOT) or record.get("service") != service:
        fail("Refusing unrelated PID record: " + str(path))
    return record


def owned_process(service, record, after_sigterm=False):
    info = process_info(int(record["pid"]))
    if info is None:
        return False
    cwd = SERVER if service == "server" else ROOT
    expected = "paper.jar" if service == "server" else str(ROOT / "director/server.mjs")
    actual_cwd = process_cwd(record["pid"])
    # A terminating JVM can close its cwd before ps stops reporting the same process.
    cwd_matches = actual_cwd == cwd.resolve() or (after_sigterm and actual_cwd is None)
    if (not record.get("executable") or info["started"] != " ".join(record.get("started", "").split()) or expected not in info["command"]
            or not info["command"].startswith(record["executable"] + " ") or not cwd_matches):
        if process_info(int(record["pid"])) is None:
            return False
        fail("PID identity changed for " + service + "; refusing to signal it. Inspect " + str(PIDS / (service + ".json")))
    return True


def port_free(port):
    with socket.socket() as listener:
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            listener.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def preflight():
    records = {name: read_record(name) for name in SERVICES}
    running = [name for name, record in records.items() if record and owned_process(name, record)]
    if len(running) == 2:
        print("EVERAFTER is already running. Panel: http://127.0.0.1:8765")
        return False
    if running:
        fail("Only " + ", ".join(running) + " is running. Run stop.sh before starting both services.")
    for port in (8765, 25565):
        if not port_free(port):
            fail("Port %s is occupied by an untracked process; leaving it untouched." % port)
    for name in SERVICES:
        (PIDS / (name + ".json")).unlink(missing_ok=True)
    return True


def write_properties():
    path = SERVER / "server.properties"
    lines = path.read_text().splitlines() if path.exists() else []
    forced = {"server-ip": "127.0.0.1", "server-port": "25565", "online-mode": "true",
              "level-name": "bootstrap", "level-type": "minecraft:flat",
              "generator-settings": json.dumps(FLAT, separators=(",", ":")),
              "gamemode": "adventure", "difficulty": "normal", "max-players": "2",
              "generate-structures": "false", "spawn-protection": "0", "allow-nether": "false",
              "enable-rcon": "false", "enable-query": "false", "management-server-enabled": "false",
              "spawn-monsters": "false", "spawn-animals": "false", "pause-when-empty-seconds": "-1",
              "view-distance": "10", "simulation-distance": "6", "enforce-secure-profile": "false",
              "motd": "EVERAFTER - A world that listens"}
    kept = [line for line in lines if line.split("=", 1)[0] not in forced]
    path.write_text("\n".join(kept + [key + "=" + value for key, value in forced.items()]) + "\n")


def spawn(service, command, cwd, env):
    LOGS.mkdir(parents=True, exist_ok=True)
    PIDS.mkdir(parents=True, exist_ok=True)
    log = LOGS / (service + ".log")
    with log.open("ab", buffering=0) as output, open(os.devnull, "rb") as empty:
        output.write(("\n--- EVERAFTER start %s ---\n" % time.strftime("%Y-%m-%d %H:%M:%S")).encode())
        process = subprocess.Popen(command, cwd=str(cwd), env=env, stdin=empty, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
    info = process_info(process.pid)
    if not info:
        fail(service + " exited immediately. Inspect " + str(log))
    record = {"root": str(ROOT), "service": service, "pid": process.pid,
              "started": info["started"], "executable": command[0]}
    (PIDS / (service + ".json")).write_text(json.dumps(record, indent=2) + "\n")
    print("Started %s (PID %s). Log: %s" % (service, process.pid, log))


def wait_port(service, port, seconds):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        record = read_record(service)
        if not record or not owned_process(service, record):
            fail(service + " exited. Inspect " + str(LOGS / (service + ".log")))
        with socket.socket() as connection:
            connection.settimeout(.3)
            if connection.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(.3)
    fail(service + " did not become ready. Inspect " + str(LOGS / (service + ".log")) + "; stop.sh can stop it safely.")


def start(play=False):
    if not preflight():
        if play:
            launch_prism()
        return
    node = shutil.which("node")
    if not node:
        fail("Install Node 22 or newer first.")
    major = int(text_command([node, "--version"]).lstrip("v").split(".")[0])
    if major < 22 or "--env-file-if-exists" not in text_command([node, "--help"]):
        fail("Node 22 with --env-file-if-exists support is required.")
    home = java_home()
    java = str(home / "bin/java")
    env = child_environment()
    version = subprocess.run([java, "-version"], text=True, capture_output=True, env=env)
    if 'version "21.' not in version.stderr:
        fail("The Minecraft server requires Java 21.")
    maven = TOOLING / ("apache-maven-" + MAVEN_VERSION) / "bin/mvn"
    mvn = str(maven) if maven.exists() else shutil.which("mvn")
    if not mvn or not (SERVER / "paper.jar").exists():
        fail("Maven or Paper is missing. Run ./scripts/setup.sh first.")
    eula = SERVER / "eula.txt"
    if not eula.exists() or not any(line.strip().lower() == "eula=true" for line in eula.read_text().splitlines()):
        fail("Read https://aka.ms/MinecraftEULA, then run setup.sh --accept-eula if you agree.")
    env["JAVA_HOME"] = str(home)
    env["PATH"] = str(home / "bin") + os.pathsep + env.get("PATH", "")
    env["DIRECTOR_PORT"] = "8765"
    env["EVERAFTER_CLIENT_TOKEN_FILE"] = str(ROOT / "director/runtime/client-token")
    director_env = env.copy()
    if "MUBIT_API_KEY" in os.environ:
        director_env["MUBIT_API_KEY"] = os.environ["MUBIT_API_KEY"]
    if "OPENROUTER_API_KEY" in os.environ:
        director_env["OPENROUTER_API_KEY"] = os.environ["OPENROUTER_API_KEY"]
    subprocess.run([mvn, "-q", "-f", str(ROOT / "plugin/pom.xml"), "package"], cwd=str(ROOT), env=env, check=True)
    (SERVER / "plugins").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "plugin/target/everafter.jar", SERVER / "plugins/everafter.jar")
    write_properties()
    spawn("director", [node, "--env-file-if-exists=" + str(ROOT / ".env"), str(ROOT / "director/server.mjs")], ROOT, director_env)
    wait_port("director", 8765, 10)
    spawn("server", [java, "-Xms512M", "-Xmx3G", "-Dterminal.jline=false", "-Dterminal.ansi=false",
                     "-jar", "paper.jar", "--nogui"], SERVER, env)
    wait_port("server", 25565, 55)
    print("EVERAFTER ready. Panel: http://127.0.0.1:8765  Minecraft: 127.0.0.1:25565")
    if play:
        launch_prism()


def stop():
    records = {name: read_record(name) for name in SERVICES}
    # Validate every identity before signaling either process.
    for name, record in records.items():
        if record:
            owned_process(name, record)
    for name in SERVICES:
        record = records[name]
        if not record:
            continue
        if owned_process(name, record):
            try:
                os.kill(record["pid"], signal.SIGTERM)
            except ProcessLookupError:
                (PIDS / (name + ".json")).unlink(missing_ok=True)
                continue
            deadline = time.monotonic() + (45 if name == "server" else 5)
            while time.monotonic() < deadline and owned_process(name, record, after_sigterm=True):
                time.sleep(.2)
            if owned_process(name, record, after_sigterm=True):
                fail(name + " is still saving/running. No force kill was sent; inspect its log and try stop.sh again.")
            print("Stopped " + name + " gracefully.")
        (PIDS / (name + ".json")).unlink(missing_ok=True)


def archive_story():
    for port in (8765, 25565):
        if not port_free(port):
            fail("Cannot reset story while port %s is still occupied." % port)
    state = ROOT / "director/runtime/state.json"
    if state.exists():
        archive = state.with_name("state.%s.%s.json" % (time.strftime("%Y%m%d-%H%M%S"), time.time_ns()))
        state.rename(archive)
        print("Previous narrative preserved at " + str(archive))
    # World directories remain intact; the plugin creates a fresh world on startup.


def launch_prism():
    binary = shutil.which("prismlauncher")
    if not binary:
        for app in (Path("/Applications/Prism Launcher.app"), Path("/Applications/PrismLauncher.app")):
            candidate = app / "Contents/MacOS/prismlauncher"
            if candidate.is_file():
                binary = str(candidate)
                break
    if not binary:
        print("Prism Launcher was not found. Open its EVERAFTER instance and join 127.0.0.1 manually.")
        return
    with open(os.devnull, "rb") as empty, (LOGS / "prism.log").open("ab") as log:
        subprocess.Popen([binary, "--launch", "EVERAFTER", "--server", "127.0.0.1"], stdin=empty,
                         stdout=log, stderr=subprocess.STDOUT, start_new_session=True, close_fds=True, env=child_environment())
    print("Opened Prism's EVERAFTER instance; normal Microsoft account authentication applies.")


def download(url, destination, digest, algorithm="sha256"):
    if destination.exists() and hashlib.new(algorithm, destination.read_bytes()).hexdigest() == digest:
        return
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "Everafter-local-setup/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as output:
            shutil.copyfileobj(response, output)
        if hashlib.new(algorithm, temporary.read_bytes()).hexdigest() != digest:
            fail("Checksum verification failed for " + destination.name)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def extract(archive):
    with tarfile.open(archive) as package:
        for entry in package.getmembers():
            if not (TOOLING / entry.name).resolve().is_relative_to(TOOLING.resolve()):
                fail("Archive contains an unsafe path")
            if entry.issym() or entry.islnk():
                target = (TOOLING / entry.name).parent / entry.linkname if entry.issym() else TOOLING / entry.linkname
                if not target.resolve().is_relative_to(TOOLING.resolve()):
                    fail("Archive contains an unsafe link")
        package.extractall(TOOLING)


def setup(accept_eula=False):
    if not all(port_free(port) for port in (8765, 25565)):
        fail("Stop running EVERAFTER services before setup; no live files were changed.")
    TOOLING.mkdir(parents=True, exist_ok=True)
    SERVER.mkdir(parents=True, exist_ok=True)
    os_name = {"Darwin": "mac", "Linux": "linux"}.get(platform.system())
    arch = {"arm64": "aarch64", "aarch64": "aarch64", "x86_64": "x64"}.get(platform.machine())
    if not os_name or not arch:
        fail("Automatic runtime setup supports macOS/Linux ARM64/x64. Install Java21, Maven3.9.16 and Paper1.21.11 build132 manually.")
    filename = "OpenJDK21U-jdk_%s_%s_hotspot_21.0.13_9.tar.gz" % (arch, os_name)
    java_url = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/" + filename
    checksum_url = java_url + ".sha256.txt"
    # The supplied Apple Silicon runtime is pinned; other platforms use the publisher's checksum.
    if os_name == "mac" and arch == "aarch64":
        checksum = "bf036b35b071bfb2f54f2c0af8ee8d88afa95ee6eb3dce02c0f94cfc2524d04a"
    else:
        checksum = urllib.request.urlopen(checksum_url, timeout=30).read().decode().split()[0]
    download(java_url, TOOLING / "java.tar.gz", checksum)
    relative_java = "Contents/Home/bin/java" if os_name == "mac" else "bin/java"
    if not (TOOLING / ("jdk-" + JAVA_VERSION) / relative_java).is_file():
        extract(TOOLING / "java.tar.gz")
    maven_url = "https://downloads.apache.org/maven/maven-3/%s/binaries/apache-maven-%s-bin.tar.gz" % (MAVEN_VERSION, MAVEN_VERSION)
    download(maven_url, TOOLING / "maven.tar.gz", MAVEN_SHA512, "sha512")
    if not (TOOLING / ("apache-maven-" + MAVEN_VERSION) / "bin/mvn").is_file():
        extract(TOOLING / "maven.tar.gz")
    paper_url = "https://fill-data.papermc.io/v1/objects/" + PAPER_SHA256 + "/paper-1.21.11-132.jar"
    download(paper_url, SERVER / "paper.jar", PAPER_SHA256)
    write_properties()
    eula = SERVER / "eula.txt"
    if accept_eula:
        eula.write_text("# Accepted explicitly with setup.sh --accept-eula\neula=true\n")
    elif not eula.exists():
        eula.write_text("# Read https://aka.ms/MinecraftEULA before accepting.\neula=false\n")
    print("Pinned Java21, Maven3.9.16 and Paper1.21.11 build132 are ready; downloaded archives passed SHA checks.")
    print("Node22+ and a licensed Minecraft account are required. No keys or provider calls were created.")
    print("Optional local voice uses .tooling/whisper.cpp/build/bin/whisper-cli and .tooling/ggml-tiny.en.bin; chat works without them.")
    if "eula=true" not in eula.read_text():
        print("Before starting, read https://aka.ms/MinecraftEULA and run setup.sh --accept-eula if you agree.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("start", "stop", "restart", "setup"))
    parser.add_argument("--play", action="store_true", help="Open Prism Launcher's EVERAFTER instance after startup")
    parser.add_argument("--accept-eula", action="store_true", help="Explicitly accept the Minecraft EULA during setup")
    parser.add_argument("--dry-run", action="store_true", help="Show the plan without reading credentials or changing services/files")
    args = parser.parse_args()
    if args.dry_run:
        print("%s: repo=%s; director=127.0.0.1:8765; Paper=127.0.0.1:25565; logs=%s; play=%s" % (args.action, ROOT, LOGS, args.play))
        if args.action == "restart":
            print("Verify identities; SIGTERM owned services; archive stopped narrative state; start fresh story; preserve worlds.")
        return
    RUNTIME.mkdir(parents=True, exist_ok=True)
    with (RUNTIME / ".lifecycle.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            fail("Another EVERAFTER lifecycle command is running.")
        if args.action == "setup":
            setup(args.accept_eula)
        elif args.action == "stop":
            stop()
        elif args.action == "restart":
            stop()
            archive_story()
            start(args.play)
        else:
            start(args.play)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError) as error:
        print("EVERAFTER: " + str(error), file=sys.stderr)
        sys.exit(1)
