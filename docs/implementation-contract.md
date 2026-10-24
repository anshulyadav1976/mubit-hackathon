# EVERAFTER implementation contract

The current response, NPC, world-builder and scene-voice contract is [story-v2-contract.md](story-v2-contract.md). Runtime trust boundaries and the authoritative quest sequence are documented in [architecture.md](architecture.md). These replace the original two-route/three-rune prototype contract.

Paper 1.21.11 and Fabric 1.21.11 use Java 21; the local Node director requires Node 22. Both services bind to loopback. Minecraft uses online authentication. Provider credentials stay in the ignored backend configuration and are stripped from build/game processes. Existing worlds are preserved.

The model proposes bounded dialogue, chapter fields and conversational intents. Paper validates actual evidence, answers, boss outcomes, stage transitions and rescue. Generated prose is text, never commands. Geometry is assembled from four authored realm templates with trial/twist choices. A committed chapter does not regenerate beneath a player.

All NPC inputs converge on the same plugin flow: native voice, ordinary chat, `/talk`, and optional browser diagnostics. Native voice requires no Screen. Raw microphone audio remains on the local machine. Nearby scripted/typed speech uses `everafter:scene`; correlated voice replies use `everafter:reply`, with no duplicate narration. Async results carry identity/generation guards.

No paid training or evaluation runs on startup. Legacy v1 paid runners refuse story v2. Adapter training, passing gates and serving must be established independently; ordinary preference memory and successful gateway calls do not prove learning. Current provider/training evidence is recorded in [evaluation.md](evaluation.md).

Complete reset uses `./scripts/restart.sh`, which gracefully stops owned services, archives narrative state, and creates a fresh quest world. `/everafter reset` points to that workflow. `/api/reset` clears narrative state only and must not be presented as a complete game reset.
