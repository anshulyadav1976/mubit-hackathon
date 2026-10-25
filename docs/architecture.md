# EVERAFTER architecture

## Components

| Component | Responsibility |
| --- | --- |
| Paper 1.21.11 / Java 21 | Authoritative quest stages, evidence, encounters, damage, moving NPCs, dialogue bubbles, escort and reunion |
| WorldBuilder | Four authored realms and village; bounded block batches and stage barriers |
| Fabric 1.21.11 / Java 21 | In-world microphone/HUD, correlated voice turns, unsolicited scene narration and system WAV playback |
| Node 22 director | Validated story contract, bounded history/preferences, Mubit story-text requests, labelled deterministic local fallback and honest source metrics |
| whisper.cpp / tiny.en | Local mono PCM16 16kHz transcription, up to 15 seconds per turn |
| OpenRouter speech | Expressive Gemini 3.8 Flash TTS; six distinct character voices and delivery directions |
| macOS speech | Local fallback synthesis; system afplay follows the selected output device |

The plugin/client call the loopback director at `127.0.0.1:8765`. Provider credentials are backend-only. Microphone audio stays local; submitted story text/context goes to Mubit. Hosted speech receives NPC reply text; its delivery instructions are separate from the spoken transcript.

## Story and quest

The [playable quest graph](quest-graph.md) maps the actual branches and evidence guards from the missing-sister introduction to the reunion. Runtime progression is an explicit server-owned state machine; geometry tests use graph reachability separately.

The [story-v2 contract](story-v2-contract.md) defines six NPC identities; mystery/combat/hybrid approaches; four realms; riddle/gauntlet/parley trials; three bounded twists; and proposed answer/challenge/bargain intents. The LLM interprets conversational choices and offers dialogue/hints. It never executes commands or directly awards quest progress.

| Stage | Server-validated progress |
| --- | --- |
| Village | Mara/Oren introduce leads. The player chooses a direction through dialogue, then explicitly enters the gate. |
| Arrival | Discover the marked clue and meet Ivo. |
| Trial | Solve the realm’s riddle, defeat its wave, or make an evidence-based appeal. Earn the trial artifact. |
| Sentinel | Defeat the minor boss or earn passage through a validated bargain. |
| Warden | Defeat the final boss or earn a stronger bargain from actual evidence and earlier outcomes. |
| Rescue | Reach Elin’s refuge and start the escort. |
| Reunion | Bring Elin home to Mara; celebrate and record actual outcomes. |

Chapter realm/trial/twist, route, mood and difficulty lock when construction begins. Geometry uses authored modules, not arbitrary generated blocks. Stage facts and outcomes remain server-authoritative even if a model invents a victory. Friendly NPCs patrol/face the player; Elin follows after rescue; boss combatants have actual health and staged behavior. Damage/death, reconnects and safe-return commands preserve progress within the current server run.

## Voice and trust boundaries

A fresh targeted use-key press allows `everafter:open`, which supplies a local capability and starts recording without creating a Screen. A distinct second press finishes. The client transcribes locally and sends `everafter:say` with entity/request identity. Paper checks ownership, selected persistent NPC identity, world, bounded text and six-block reach.

Correlated `everafter:reply` carries dialogue/source/request identity. `everafter:scene` carries nearby scripted, proximity or typed narration with player/entity/NPC identity and the local capability. The client accepts only loopback server port 25565. Scenes cannot interrupt capture, transcription or a pending reply; opening a screen, losing focus, death/disconnect or leaving reach cancels late work. All audio/HTTP stays off the render thread.

`/api/speech` requires the fresh 64-hex `X-Everafter-Token`; no provider key travels in game packets. Temporary synthesis/playback files are private and cleaned up. macOS WAV playback uses a bounded cancellable afplay process. Other platforms use Java Sound; local synthesis currently requires macOS. Optional hosted synthesis has a persistent attempt budget and small cache. Subtitles remain if voice fails.

The director enforces Host, loopback remote address, Origin, body limits, input constraints and static paths. `/api/transcribe` retains those checks for legacy browser recording but does not require the voice capability. The optional browser panel is diagnostic; gameplay needs no secondary interface.

## Providers, state and evaluation

All story-text inference goes through Mubit. Missing credentials, an exhausted request budget or a failed/invalid Mubit response produce a labelled deterministic local fallback (`source=fallback`). Story text is never rerouted to OpenRouter. OpenRouter is used only for optional hosted text-to-speech of the already generated NPC reply. Replies retain the actual text source and bounded error codes. The stable production prompt identifies a recurring story task; context changes do not establish weight updates.

A server startup creates a fresh dedicated `everafter_<timestamp>` world. Old world directories are retained. Quest progress lives in memory for that server run; narrative memory/metrics live in ignored director runtime files. `./scripts/restart.sh` verifies service identities, gracefully stops both, archives narrative state, and starts a fresh quest. It preserves earlier worlds and archives. The browser has no reset button.

Legacy three-NPC training/evaluation fixtures are incompatible with story v2. Their live runners refuse the new contract. A passing legacy adapter would still require a separate v2 dataset, matched evaluation and actual serving evidence before being called suitable for this game.
