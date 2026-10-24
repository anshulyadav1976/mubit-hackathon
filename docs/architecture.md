# EVERAFTER architecture

## Components

| Component | Responsibility |
| --- | --- |
| Paper 1.21.11 / Java 21 plugin | Player controls, protected NPCs, authoritative quest state, compass and bossbar, safe transitions, combat, rescue, and world construction scheduling |
| `WorldBuilder` | Authored village and two adventure families, deterministic palette/atmosphere changes, bounded batches of at most 1,500 edits per tick |
| Fabric 1.21.11 client / Java 21 | Native NPC dialogue screen, editable transcript, bounded Java Sound microphone recording, correlated replies, and WAV playback |
| Node 22 local director | Validates messages, stores bounded conversation and preferences, calls Mubit, validates replies, exposes local UI state and an input inbox |
| Browser director panel, optional | Displays narrative state, response source, preferences and available metrics; retains the legacy input/voice path for diagnostics |
| Local whisper.cpp / tiny.en | Transcribes short recordings on this computer; supplies editable text without sending audio to Mubit |
| Mubit gateway | Provides dialogue and structured scene proposals through its OpenAI-compatible endpoint |
| OpenRouter speech / macOS `say` | Synthesizes NPC reply text with character-specific voices; hosted speech falls back to local macOS speech |

The plugin and client call only `http://127.0.0.1:8765`. Dialogue and structured scene proposals go through Mubit. A separate speech service calls OpenRouter's audio endpoint when configured, with macOS `say` as fallback. Provider credentials stay in the backend configuration and are not sent in Minecraft packets or browser responses.

## Data flow

Right-clicking a protected story NPC opens the Fabric dialogue screen through `everafter:open`. Java Sound captures up to 15 seconds off the render thread, converts supported native microphone formats into mono PCM16 16kHz WAV, and posts to local `/api/transcribe`. whisper.cpp returns an editable transcript; the player reviews and explicitly sends it. `everafter:say` carries the entity ID, bounded message, and request ID. Paper revalidates the selected NPC's persistent identity, world, and six-block reach before calling the existing dialogue method. Normal chat, `/talk`, and optional confirmed browser input converge on that same method.

`everafter:reply` carries the NPC, request ID, dialogue, source, and authoritative phase. The client rejects stale NPC/request replies, displays the subtitle, and requests a WAV from `/api/speech` for automatic Java Sound playback. Scripted greetings and idle typed-chat replies use an empty request ID. Closing the screen stops capture/playback and discards late results. HTTP, recording, and playback run on background workers; UI changes return to the client thread. No browser is required.

Temporary recognition audio/transcript and local-speech files are cleaned up after processing. Microphone audio stays on this computer. Submitted text and narrative context continue to Mubit; NPC reply text goes to OpenRouter only when hosted speech is configured and available. Cloud speech has a persisted bounded attempt budget and a small memory cache; unavailable hosted speech uses local macOS voices. If playback fails, the subtitle remains. A dialogue request contains the player's identifier, selected NPC, phase, bounded message, and authoritative world facts. The director adds the stored preference profile and recent conversation to a stable system prompt.

The reply includes dialogue, a `mystery` or `combat` route, `eerie` or `wonder` atmosphere, and difficulty 1–3. Both the director and plugin validate the data. Generated text is displayed as text; it is never evaluated as JavaScript, shell, or Minecraft commands. Invalid or unavailable replies produce a visibly labelled deterministic fallback.

Minecraft world access and quest mutations happen on the server's main thread. Java `HttpClient` requests run asynchronously, and their callbacks schedule results back onto that thread. The plugin polls the browser inbox no more than once per second and drains one message at a time. A player has at most one active dialogue request.

## Authoritative quest loop

| Phase | Completion condition | Result |
| --- | --- | --- |
| `village` | Player explicitly enters crossing or uses `/everafter go` | Last validated chapter choice is committed and built once |
| `adventure`, mystery | Three accessible rune markers activated, then Elin right-clicked | `rescued` |
| `adventure`, combat | Bounded guards defeated, then Elin right-clicked | `rescued` |
| `rescued` | Player uses return arch or `/everafter home` | Elin moves to Mara; village celebrates; `complete` |
| `complete` | Further conversation | Director receives the completed facts; no new chapter is generated |

The model cannot mark a rune activated, kill a guard, rescue Elin, or complete the quest. The server derives these facts from game events. Scene proposals may change while the player remains in the village; committed scene geometry does not change beneath a player.

The combat population is 5, 7, or 9 guards. Guards do not despawn normally, and a watchdog resolves missing entities and returns escaped guards to the arena. NPCs are protected. The player retains equipment and progress on death; damage is bounded, and safe return commands remain available. Mystery progress is visible through labels, particles, the compass, and the bossbar.

## Local state and reset

Each server startup makes a fresh dedicated `everafter_<timestamp>` world, avoiding edits to prior world directories. Quest progress is in memory for that run. Reconnects retain it while the same server process remains alive. Restarting the server begins a fresh quest; prior story world directories are retained until explicitly removed by the user.

The director persists bounded profiles, recent conversation, preference corrections, and metrics in an ignored runtime directory. For a fully fresh session, `./scripts/restart.sh` verifies and gracefully stops both owned services, archives the director state, and restarts the services; the plugin then creates a fresh world. Prior Minecraft worlds and archived narrative files remain intact. The browser has no reset button; `/everafter reset` points to this script. The low-level `/api/reset` endpoint is not a complete game reset and is not the demo reset workflow.

Both services listen on loopback. The director checks Host, remote address, browser Origin, request sizes, input constraints, and static-file paths. The Minecraft server uses online authentication. This is a local single-adventurer prototype, not a publicly hardened multiplayer service.

The backend writes a fresh 64-hex local capability to `director/runtime/client-token` at startup; Paper rereads it for each NPC open and sends it only as `backendToken`, never a provider key. The client sends `X-Everafter-Token` on both voice requests. `/api/speech` requires that capability. `/api/transcribe` retains loopback, Host and Origin protection for the legacy browser flow and does not currently require the capability. The client accepts dialogue packets only from loopback Minecraft port 25565 and checks the player ID before opening a screen.

## Mubit evidence

Live replies record source, latency, request identifier, model, session identifier, and any token usage returned by the gateway. Startup itself performs no paid request. An explicit bounded synthetic script can exercise shared-task requests and save honest observations. It stops if a request falls back.

Preference retention is ordinary application memory. Successful gateway requests do not by themselves establish adapter training, adapter convergence, or improvement. Those require separate Mubit-console or training-event evidence and a valid before/after evaluation.
