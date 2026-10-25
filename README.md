# EVERAFTER

A local Minecraft story about a village, a missing sister, and a next chapter that responds to what you tell its characters.

Mara’s sister Elin is missing. Mara and archivist Oren offer leads: a burning compass, a drowned page, a bell above the clouds, and a thornwood ribbon. Answer naturally; you do not need to declare abstract preferences. The director interprets your answer into a realm, trial, atmosphere, difficulty, and story twist. Follow Ivo’s guidance, discover evidence, solve a trial, confront two bosses, and escort Elin home.

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

For in-world voice conversations, first create or use a Prism instance named **EVERAFTER** running Minecraft **1.21.11**. Close Minecraft before installing the client; the installer preserves its login, options, and worlds:

```sh
./client-mod/build.sh
python3 client-mod/install-prism.py --minecraft-closed
```

Install the local recognition engine with `./scripts/setup-voice.sh` for microphone input on macOS; its prerequisites are described below. Start both local services and launch the existing Prism instance:

```sh
./scripts/start.sh --play
```

Join `127.0.0.1:25565` and right-click a villager. Voice conversations and spoken replies stay in the world, with a small HUD instead of a dialogue screen; no browser frontend is needed. The optional [director panel](http://127.0.0.1:8765) remains available for diagnostics. The scripts do not create a Prism instance or bypass Microsoft authentication. Both services bind to loopback; the Minecraft server uses online authentication.

Stop the services with:

```sh
./scripts/stop.sh
```

Set `MUBIT_API_KEY` in the ignored root `.env` file or process environment to enable Mubit. The start script loads `.env` only into the local director process. Keep it out of source control. `MUBIT_MODEL` chooses the model requested through the Mubit gateway; the current default is `gpt-6-luna`. All hosted story-text requests go through Mubit. Missing credentials, a failed/invalid response or an exhausted request budget produce labelled deterministic local dialogue. OpenRouter supplies optional hosted speech, not an alternate story-text provider. A `mubit` response label establishes the gateway source, not independently verified adapter serving.

Copy [`.env.example`](.env.example) to `.env` for the supported defaults; its API-key placeholder is empty. Restart the director after changing configuration. Configuring a key alone does not run training or evaluation.

## Voice

Optional local speech recognition uses **whisper.cpp with tiny.en**. The voice setup script targets macOS and requires Python 3 with pip, Git, curl, and Apple command line tools (`xcode-select --install` if missing). It builds the pinned engine and verifies the model download; no voice API key or ffmpeg is needed. Install its separate runtime and model with:

```sh
./scripts/setup-voice.sh
```

Right-click **Mara**, **Oren**, **Ivo**, **Sentinel**, **Warden**, or **Elin** and speak without leaving the world. Right-click again to finish; a turn also stops after 15 seconds. Local whisper.cpp transcribes the recording and sends the text automatically to the selected NPC. A compact HUD shows listening, transcription, and reply status; the reply appears as a subtitle and plays aloud while movement stays available. Holding right-click does not repeatedly start and stop recording. Opening a menu, losing focus, disconnecting, dying, or moving outside conversation reach cancels capture and stale results. Normal Minecraft chat and `/talk <message>` remain available for typed input or correcting a misheard line. Recording, transcription, and playback run off the render thread.

Recognition sends mono PCM WAV only to the local `/api/transcribe` endpoint. It does not send microphone audio to Mubit or OpenRouter. Transcribed text and narrative context go to the configured text provider. NPC speech defaults to OpenRouter `google/gemini-3.8-flash-tts`, with a distinct prebuilt voice and emotional delivery instructions for each character. macOS playback uses `/usr/bin/afplay` on the current system output device. Missing credentials or a hosted failure falls back to local speech; set `EVERAFTER_TTS_PROVIDER=macos` to use local synthesis explicitly. Hosted speech receives NPC reply text. Temporary audio files are removed after processing; submitted dialogue remains in ignored local narrative history until archived.

Nearby scripted guidance and typed replies also use the in-world speech channel. Text bubbles follow characters above their heads. NPC narration cannot interrupt a recording or pending turn; right-clicking interrupts narration to start listening. Subtitles remain if output fails.
Allow microphone access for Minecraft/Java or Prism in macOS System Settings → Privacy & Security → Microphone if requested. The native in-world smoke check captured speaker audio after right-click, automatically submitted the transcript on the next click, and received a Mubit reply from Mara with HUD subtitles and speech while movement stayed available. A held press followed by Escape cancelled without a dialogue request. This checks the integrated flow, not speech accuracy; tiny.en can mishear words in a noisy room, and chat or `/talk` can correct them.

## Play

1. Approach Mara and hear her opening clue. Right-click to record, speak, then right-click again to send. Normal chat and `/talk <message>` work too.
2. Ask about a lead in ordinary language: “The burning compass sounds dangerous. What if we find out why they’re guarding her?” You can revise the plan before crossing.
3. Enter the northern gate or use `/everafter go`. The server assembles the selected **Ember Keep**, **Sunken Archive**, **Sky Monastery**, or **Thornwild** from authored geometry. Ember Keep is Nether-themed scenery in the quest world.
4. Meet Ivo, discover the marked evidence, and complete the selected trial: answer a realm-specific riddle, defeat a guard wave, or make an evidence-based appeal. Ask for hints if stuck.
5. Confront the **Sentinel**, then the **Warden**. Fight real boss entities or earn a validated bargain using the clue, artifact, and your earlier choices. Dialogue alone cannot grant a victory.
6. Reach Elin. She follows you toward the return gate. Bring her home to Mara for the reunion, celebration, and a chronicle of the choices actually made.

`/everafter help` explains controls; `/everafter status` gives the exact next action. Compass, bossbar, actionbar, bubbles and voiced hints guide progress. `/everafter home` provides a safe return, and `/everafter go` returns to an unfinished chapter without rebuilding it. Friendly NPCs are protected; bosses are combatants. Death preserves gear and quest progress.

## Build and check

```sh
mvn -f plugin/pom.xml package
node --test director/test/*.test.mjs
./client-mod/build.sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s client-mod -p 'test_*.py'
```

The plugin artifact is `plugin/target/everafter.jar`. The launch script installs it in the dedicated local Paper server. Java parser tests check malformed director data, bounded scene fields, and input sanitation. Director tests cover its own validation and local HTTP behavior. See the [story-v2 validation](docs/story-v2-validation.md), [demo guide](docs/demo.md), [architecture](docs/architecture.md), [evaluation evidence](docs/evaluation.md), and [judging argument](docs/judging.md) for the demo sequence and trust boundaries.

## Scope and limits

This is one adventurer's story per server run; additional players can spectate. Each run creates a fresh `everafter_<timestamp>` world and leaves prior world directories in place. Minecraft quest state does not persist across server restarts. For a fully fresh story, run:

```sh
./scripts/restart.sh
```

This gracefully stops both owned services, archives the previous director state, and starts a fresh quest and narrative memory. Old Minecraft worlds and archived narrative files are retained. The browser has no reset button. `/everafter reset` points to this safe restart command.

Four authored realms combine with three trial types and bounded story twists. This is AI-directed assembly, not arbitrary generated terrain or endless content. A chosen chapter is fixed when construction begins; conversations and validated encounters continue within it. Native voice requires the Fabric client, a working microphone and output device, and macOS permission; recognition is English with tiny.en. Mubit availability, model access, adapter training, and performance claims require separate provider evidence. No paid training loop or load test runs automatically on startup.

## Film and prepared training corpus

The [film package](media/everafter-film/README.md) contains editable HyperFrames projects for a 165-second film and 20-second teaser, a six-slide PDF builder, and the Minecraft recorder. Actual captures and private request provenance stay local. The film uses a labelled continuous replay of a verified Mubit decision, historical session counters, and explicit prepared-training status; it does not claim a passing adapter or measured savings.

The [story-v2 corpus](docs/story-v2-training-preparation.md) is frozen: **240 authored candidate turns across 60 sessions**, plus **60 held-out turns across 15 separate sessions**. All 300 pass offline validation. The user authorized [separate CLI submissions on 25 October](docs/story-v2-submission.md): 100 unique candidate turns returned valid story JSON; 89 matched every authored field check. At the **00:40 BST console observation on 25 October**, the current task showed 153 usable calls, 0 kept, 153 awaiting review, 19 reviews running, first training not started and no serving route. This is a dated checkpoint, not a live status indicator. The kept-example target remains 50.
