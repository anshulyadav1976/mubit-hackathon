# Minecraft recording helper

From the repository root, build using the installed macOS SDK:

```sh
xcrun swiftc -parse-as-library -O -framework ScreenCaptureKit -framework AppKit -framework AVFoundation media/everafter-film/tools/capture-minecraft.swift -o .tooling/capture-minecraft
.tooling/capture-minecraft --self-test
.tooling/capture-minecraft OBSERVED_JAVA_PID /absolute/new-take.mp4 8
```

The supplied Java PID must own exactly one visible window titled `Minecraft…`, already frontmost. Screen Recording permission must already be granted to the launching terminal/helper. The helper never activates or controls Minecraft. Its output is 1920×1080 H.264 MP4, 30 fps, with aspect-preserving letterboxing, 48 kHz stereo system audio (including `afplay`), and **no microphone capture**. Existing output files are refused. Parent directories must exist. Duration is 1–600 seconds. Optional `--trim-top POINTS` removes only a known titlebar height (0–100 points); default 0 preserves the whole window and HUD. Resize Minecraft before recording; movement or resizing during a take stops it.

Keep Minecraft foreground throughout the take. Activation notifications and 30 Hz window checks stop capture on focus loss, movement, disappearance, or resizing. Because display capture includes system audio, a compositor transition frame or overlapping notification can appear before those asynchronous guards stop it; this is not a guarantee of zero transition frames. Keep other apps and notifications out of the take.

Wait for `CAPTURE_STARTED`, then `CAPTURE_SAVED duration=…`. The final file appears only after ScreenCaptureKit confirms flushing; failure reports `CAPTURE_ERROR` and may leave a uniquely named `.everafter-*.partial.mp4` beside it for diagnosis. Do not force-kill the helper while it flushes. A startup or finish timeout is 20 seconds. The binary is under ignored `.tooling/`; no credentials or environment values are read or printed, and provider key variables are cleared on startup.

The self-test validates arguments and crop/aspect math without permissions, metadata queries, audio devices, or recording. Root must verify a short real take for image framing, system TTS audio, and permission behavior before filming.
