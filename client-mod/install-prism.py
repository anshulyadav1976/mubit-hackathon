#!/usr/bin/env python3
"""Install only EVERAFTER's client jars and Fabric component; preserve account/options/worlds."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

MODULE = Path(__file__).resolve().parent
LOADER = "0.20.1"
API = "0.141.6+1.21.11"
API_SHA512 = "852d3682c4f353fd0ca86546af8578513e8bcf628377fa9d49c556bc59c5024c69ab56c92fc6dfba11fed19e4316a3f5636e7e07fd3d96f7043b531aef59b637"


def install(instance):
    instance = instance.expanduser().resolve()
    processes = subprocess.check_output(["ps", "-axo", "command="], text=True)
    if any("org.prismlauncher.EntryPoint" in line or (str(instance) in line and "java" in line) for line in processes.splitlines()):
        raise RuntimeError("Close Minecraft before modifying the instance. Prism Launcher itself can remain open.")
    pack = instance / "mmc-pack.json"
    document = json.loads(pack.read_text())
    components = document["components"]
    if not any(part.get("uid") == "net.minecraft" and part.get("version") == "1.21.11" for part in components):
        raise RuntimeError("The selected instance must use Minecraft 1.21.11.")
    jar = MODULE / "build/libs/everafter-client-1.0.0.jar"
    if not jar.is_file():
        raise RuntimeError("Run ./client-mod/build.sh first.")
    # Resolve only Prism's official loader metadata; Prism downloads its declared libraries on launch.
    url = "https://meta.prismlauncher.org/v1/net.fabricmc.fabric-loader/" + LOADER + ".json"
    metadata = json.load(urllib.request.urlopen(url, timeout=30))
    if metadata.get("uid") != "net.fabricmc.fabric-loader" or metadata.get("version") != LOADER:
        raise RuntimeError("Unexpected Prism Fabric metadata")
    tooling = MODULE / ".tooling"
    tooling.mkdir(exist_ok=True)
    api = tooling / ("fabric-api-" + API + ".jar")
    if not api.is_file() or hashlib.sha512(api.read_bytes()).hexdigest() != API_SHA512:
        temporary = api.with_suffix(".part")
        try:
            urllib.request.urlretrieve("https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/" + API + "/" + api.name, temporary)
            if hashlib.sha512(temporary.read_bytes()).hexdigest() != API_SHA512:
                raise RuntimeError("Official Fabric API checksum mismatch")
            temporary.replace(api)
        finally:
            temporary.unlink(missing_ok=True)
    backup = instance / "everafter-backups" / str(time.time_ns())
    backup.mkdir(parents=True)
    shutil.copy2(pack, backup / pack.name)
    mods = instance / ".minecraft/mods"
    mods.mkdir(parents=True, exist_ok=True)
    for pattern in ("everafter-client-*.jar", "fabric-api-*.jar"):
        for previous in mods.glob(pattern):
            shutil.copy2(previous, backup / previous.name)
            previous.unlink()
    for source in (jar, api):
        temporary = mods / (source.name + ".part")
        shutil.copy2(source, temporary)
        temporary.replace(mods / source.name)
    components[:] = [part for part in components if part.get("uid") != "net.fabricmc.fabric-loader"]
    components.append({"uid": "net.fabricmc.fabric-loader", "version": LOADER})
    temporary = pack.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(document, indent=2) + "\n")
    temporary.replace(pack)
    print("Installed EVERAFTER client + official Fabric API into " + str(instance))
    print("Previous pack/client jars backed up at " + str(backup))
    print("Launch the existing EVERAFTER instance normally; Microsoft authentication, options and worlds are preserved.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--instance", type=Path, default=Path.home() / "Library/Application Support/PrismLauncher/instances/EVERAFTER")
    parser.add_argument("--minecraft-closed", action="store_true", help="Confirm Minecraft has been closed; also checked against running processes")
    args = parser.parse_args()
    if not args.minecraft_closed:
        parser.error("Close Minecraft, then pass --minecraft-closed. No instance files were changed.")
    try:
        install(args.instance)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        raise SystemExit("EVERAFTER client install: " + str(error))
