#!/bin/sh
set -eu
MODULE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
JAVA_LOCAL="$MODULE/../.tooling/jdk-21.0.13+9/Contents/Home"
if [ -x "$JAVA_LOCAL/bin/java" ]; then export JAVA_HOME="$JAVA_LOCAL"; fi
unset MUBIT_API_KEY OPENROUTER_API_KEY
GRADLE="$MODULE/.tooling/gradle-9.2.1/bin/gradle"
if [ ! -x "$GRADLE" ]; then
    mkdir -p "$MODULE/.tooling"
    python3 - "$MODULE/.tooling" <<'PY'
import hashlib,pathlib,urllib.request,zipfile,sys
folder=pathlib.Path(sys.argv[1]); archive=folder/'gradle-9.2.1-bin.zip'
checksum='72f44c9f8ebcb1af43838f45ee5c4aa9c5444898b3468ab3f4af7b6076c5bc3f'
if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest()!=checksum:
    temporary=archive.with_suffix('.part')
    urllib.request.urlretrieve('https://services.gradle.org/distributions/gradle-9.2.1-bin.zip',temporary)
    if hashlib.sha256(temporary.read_bytes()).hexdigest()!=checksum:
        temporary.unlink();raise SystemExit('Gradle checksum failed')
    temporary.replace(archive)
with zipfile.ZipFile(archive) as package: package.extractall(folder)
(folder/'gradle-9.2.1/bin/gradle').chmod(0o755)
PY
fi
exec "$GRADLE" --no-daemon -p "$MODULE" "${@:-build}"
