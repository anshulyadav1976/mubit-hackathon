# EVERAFTER Minecraft client

Fabric client for Minecraft Java **1.21.11 / Java 21**, used with the local Paper server. Right-click Mara, Oren, or Elin to start listening in the world. Speak, then right-click again to finish; capture also stops after 15 seconds. Local transcription sends automatically, and NPC subtitles and spoken replies appear without opening a secondary screen. A compact HUD shows the current status. Holding right-click counts as one press. Normal Minecraft chat and `/talk` remain available for typed input and corrections.

Build and run the format tests:

```sh
./client-mod/build.sh
```

The helper downloads the official Gradle 9.2.1 distribution and verifies its pinned SHA256. Build dependencies are official Minecraft mappings, Fabric Loom 1.14.10, Fabric Loader 0.20.1, and Fabric API 0.141.6+1.21.11. No provider keys are embedded or passed to the build.

After closing Minecraft, install into the existing Prism EVERAFTER instance:

```sh
python3 client-mod/install-prism.py --minecraft-closed
./scripts/start.sh --play
```

The installer adds the Fabric component and installs only this mod and the checksum-verified official Fabric API. It backs up the previous component file and matching jars under the instance's `everafter-backups/`; account login, options, and worlds are preserved. The existing Prism instance remains the launcher and keeps normal Microsoft authentication.

Voice uses the local director at `127.0.0.1:8765`. The Paper server supplies a fresh local capability token when a villager is selected. Audio is mono PCM16 16kHz WAV and sent only to `/api/transcribe`; `/api/speech` supplies WAV replies. The client sends `X-Everafter-Token` on both calls; `/api/speech` strictly requires it, while `/api/transcribe` retains loopback/Host/Origin protection for legacy browser recording. Hosted NPC speech uses the backend's OpenRouter configuration, with macOS `say` as fallback. The client accepts dialogue payloads only from loopback port 25565 and checks player/NPC/request identity. Provider credentials remain in the local backend. macOS may request microphone permission for Minecraft/Java or Prism; allow it in System Settings → Privacy & Security → Microphone.

Recording, HTTP requests, and playback run off Minecraft's render thread. Opening a menu, losing focus, disconnecting, dying, leaving conversation reach, or switching NPCs stops microphone capture/playback and discards pending results. Current limits: English local recognition, one active conversation, and a 15-second recording per turn.
