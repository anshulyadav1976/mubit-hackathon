#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TOOLING="$ROOT/.tooling"
WHISPER="$TOOLING/whisper.cpp"
COMMIT=231638a0717b7822784297e5980965ffcec05810
MODEL="$TOOLING/ggml-tiny.en.bin"
MODEL_SHA1=c78c86eb1a8faa21b369bcd33207cc90d64ae9df
CLONE_TEMP="$TOOLING/whisper.cpp.download.$$"
MODEL_TEMP="$MODEL.download.$$"

if [ "$(uname -s)" != Darwin ]; then
    echo 'Local voice setup currently supports macOS with Apple Metal.' >&2
    exit 1
fi
for tool in git curl shasum python3 xcrun; do
    command -v "$tool" >/dev/null 2>&1 || {
        echo "Missing $tool. Install Python3 and Apple command line tools first." >&2
        exit 1
    }
done
xcrun --find clang >/dev/null 2>&1 || {
    echo 'Install Apple command line tools with: xcode-select --install' >&2
    exit 1
}
mkdir -p "$TOOLING"
trap 'rm -f "$MODEL_TEMP"; if [ -d "$CLONE_TEMP" ]; then rm -rf "$CLONE_TEMP"; fi' EXIT
trap 'exit 130' HUP INT TERM

if [ -e "$WHISPER" ]; then
    if [ ! -e "$WHISPER/.git" ] || [ "$(git -C "$WHISPER" rev-parse HEAD)" != "$COMMIT" ]; then
        echo "Existing $WHISPER must be at $COMMIT; it was left untouched." >&2
        exit 1
    fi
    if ! git -C "$WHISPER" diff --quiet || ! git -C "$WHISPER" diff --cached --quiet; then
        echo 'Existing whisper.cpp has tracked changes; preserve or resolve them before building.' >&2
        exit 1
    fi
else
    git init -q "$CLONE_TEMP"
    git -C "$CLONE_TEMP" remote add origin https://github.com/ggml-org/whisper.cpp.git
    git -C "$CLONE_TEMP" fetch --depth 1 origin "$COMMIT"
    git -C "$CLONE_TEMP" checkout --detach "$COMMIT"
    mv "$CLONE_TEMP" "$WHISPER"
fi

CMAKE_BIN=$(command -v cmake || true)
if [ -z "$CMAKE_BIN" ]; then
    CMAKE_BIN="$TOOLING/pythondeps/cmake/data/bin/cmake"
    if [ ! -x "$CMAKE_BIN" ]; then
        python3 -m pip install --target "$TOOLING/pythondeps" cmake==4.4.4
    fi
fi
"$CMAKE_BIN" -S "$WHISPER" -B "$WHISPER/build" \
    -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON \
    -DGGML_METAL=ON -DCMAKE_BUILD_TYPE=Release
"$CMAKE_BIN" --build "$WHISPER/build" --config Release -j 6

ACTUAL_SHA1=
if [ -f "$MODEL" ]; then ACTUAL_SHA1=$(shasum -a 1 "$MODEL" | cut -d ' ' -f 1); fi
if [ "$ACTUAL_SHA1" != "$MODEL_SHA1" ]; then
    curl --fail --location --retry 2 \
        https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin \
        --output "$MODEL_TEMP"
    ACTUAL_SHA1=$(shasum -a 1 "$MODEL_TEMP" | cut -d ' ' -f 1)
    if [ "$ACTUAL_SHA1" != "$MODEL_SHA1" ]; then
        echo 'Whisper model checksum failed; existing model was left untouched.' >&2
        exit 1
    fi
    mv "$MODEL_TEMP" "$MODEL"
fi
test -x "$WHISPER/build/bin/whisper-cli"
echo 'Local English voice is ready: pinned whisper.cpp + verified tiny.en model.'
echo 'Open the director panel and allow microphone access. No ffmpeg or voice API key is needed.'
