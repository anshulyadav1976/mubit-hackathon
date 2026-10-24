# EVERAFTER

A local Minecraft story about a village, a missing sister, and a next chapter that responds to what you tell its characters.

Speak with Mara and archivist Oren. Prefer puzzles to combat? Want a gentler, more wondrous journey? Tell them. The director selects a bounded mystery or combat chapter, its atmosphere, and one of three challenge levels. Enter the crossing, rescue Elin, and bring her home to a visibly changed village.

The Java plugin controls every game rule and quest transition. Mubit supplies dialogue and validated scene choices through a local Node director. Scenes are assembled from authored Minecraft geometry; the model does not issue commands or place arbitrary blocks. Preferences and conversation history are ordinary session memory. Mubit completed a v1 training run, but its evaluation returned **Prompt only**, with 0/12 tests passed and no serving route. A passing adapter or measured training improvement has **not** been established; see the evaluation evidence below.

## Run locally

Requires Python 3, Node 22 or newer, Prism Launcher, and a licensed Minecraft Java account. Automatic runtime setup supports macOS and Linux on ARM64 or x64 and installs checksum-verified Java 21, Maven 3.9.16, and Paper 1.21.11 build 132 into this project.

```sh
./scripts/setup.sh
```

Read the [Minecraft EULA](https://aka.ms/MinecraftEULA). If you agree, accept it explicitly before starting:

```sh
./scripts/setup.sh --accept-eula
```

Start both local services:

```sh
./scripts/start.sh
```

Open <http://127.0.0.1:8765> for the director panel. Launch the **EVERAFTER** instance in Prism Launcher and join `127.0.0.1:25565`, or use `./scripts/start.sh --play` to ask Prism to open that existing instance. The scripts do not create a Prism instance or bypass Microsoft authentication. Both services bind to loopback; the Minecraft server uses online authentication.

Stop the services with:

```sh
./scripts/stop.sh
```

Set `MUBIT_API_KEY` in the ignored root `.env` file or process environment to enable Mubit. The start script loads `.env` only into the local director process. Keep it out of source control. `MUBIT_MODEL` chooses the gateway model. The director panel and in-game replies distinguish actual Mubit responses from local fallback. Missing credentials or a gateway error leaves the game playable through deterministic fallback.

Copy [`.env.example`](.env.example) to `.env` for the supported defaults; its API-key placeholder is empty. Restart the director after changing configuration. Configuring a key alone does not run training or evaluation.

## Voice

Optional local speech recognition uses **whisper.cpp with tiny.en**. The voice setup script targets macOS and requires Python 3 with pip, Git, curl, and Apple command line tools (`xcode-select --install` if missing). It builds the pinned engine and verifies the model download; no voice API key or ffmpeg is needed. Install its separate runtime and model with:

```sh
./scripts/setup-voice.sh
```

The director detects the installed engine and model automatically. In the director panel, choose a character and click **Speak**. Click **Stop** after speaking; recording also stops after 15 seconds. The browser sends mono PCM audio to the local `/api/transcribe` endpoint, which runs whisper.cpp on this computer. Review or edit the transcript, then press **Send** to submit it to the same dialogue flow used by Minecraft chat. Transcription never sends audio to Mubit; the confirmed text and narrative context are sent to Mubit when enabled. Temporary audio/transcript files are removed after processing. Submitted dialogue remains in local narrative history until reset or archived.

**Read replies aloud** optionally uses the browser's speech-synthesis voices. The browser chooses the voice and its processing behavior; this is separate from the verified local recognition path. The speaker-to-microphone transcription path has been checked with one sentence recognized exactly; that is a smoke check, not a speech-accuracy benchmark. Microphone permission is required, and typed chat remains available.

## Play

- Right-click **Mara**, **Oren**, or **Elin** to select a character. Type normal Minecraft chat or `/talk <message>` to speak.
- In the village, describe what you enjoy. For example: “I prefer puzzles, an eerie atmosphere, and protecting villagers.” You can correct this before entering the next area.
- Walk through the northern crossing or use `/everafter go`. The selected scene is built once, then you are transported there.
- **Mystery:** follow your compass to three glowing echo-stones and right-click each marker. Then find and right-click Elin.
- **Combat:** defeat the bounded group of Hollow Watchers. Then find and right-click Elin.
- Return through the southern arch or use `/everafter home`. With Elin rescued, the village celebrates. Speak to its characters about what happened.

`/everafter help` explains controls; `/everafter status` shows progress. Your compass, bossbar, and actionbar track the objective. `/everafter home` can be used at any time, and `/everafter go` returns to an unfinished chapter without rebuilding it. Death preserves gear and quest progress. Chat works without a microphone.

## Build and check

```sh
mvn -f plugin/pom.xml package
node --test director/test/*.test.mjs
```

The plugin artifact is `plugin/target/everafter.jar`. The launch script installs it in the dedicated local Paper server. Java parser tests check malformed director data, bounded scene fields, and input sanitation. Director tests cover its own validation and local HTTP behavior. See the [demo guide](docs/demo.md), [architecture](docs/architecture.md), [evaluation evidence](docs/evaluation.md), and [judging argument](docs/judging.md) for the demo sequence and trust boundaries.

## Scope and limits

This is one adventurer's story per server run; additional players can spectate. Each run creates a fresh `everafter_<timestamp>` world and leaves prior world directories in place. Minecraft quest state does not persist across server restarts. For a fully fresh story, run:

```sh
./scripts/restart.sh
```

This gracefully stops both owned services, archives the previous director state, and starts a fresh quest and narrative memory. Old Minecraft worlds and archived narrative files are retained. The browser has no reset button. `/everafter reset` points to this safe restart command.

Only two authored chapter families exist. A chosen chapter is fixed when generation begins, although conversation can continue afterward. Browser speech availability depends on the browser and its permissions. Mubit availability, model access, adapter training, and performance claims require separate provider evidence. No paid training loop or load test runs automatically on startup.
