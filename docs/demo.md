# EVERAFTER demo guide

## Start

Use the existing Prism **EVERAFTER** instance. With Minecraft closed, install the client with `./client-mod/build.sh` and `python3 client-mod/install-prism.py --minecraft-closed`. Local recognition is installed by `./scripts/setup-voice.sh`. Start with `./scripts/start.sh --play` and join `127.0.0.1:25565`.

The game needs no browser. A small HUD, subtitles, and bubbles above moving characters carry the conversation. Right-click a character, speak, then right-click again to finish and automatically send. Capture stops after 15 seconds. Opening a menu cancels it. Type normal chat or `/talk <words>` for corrections.

NPC voices use OpenRouter Gemini 3.8 Flash TTS, with distinct character voices and emotional delivery instructions. Check the Mac’s output device and volume if a subtitle appears silently. Unavailable hosted speech falls back to local macOS speech. A successful speech HTTP response alone does not establish audible output.

## Story-led demo

1. Approach Mara. Let her offer the leads to Elin before answering. Ask “What happened?” if you need more context. Oren can explain other leads.
2. Answer conversationally: “That burning compass sounds dangerous. Could we figure out why someone is guarding her before drawing our swords?” The director should infer a realm and approach from the story, rather than a preference form.
3. Show the validated chapter preview. Revise it before crossing if desired: “Actually, the drowned page interests me more. Let’s follow that.” Wait for the response before moving away.
4. Enter the village gate or use `/everafter go`. The chosen realm is assembled from authored scenery. Describe this as **AI-directed assembly**. Ember Keep is Nether-themed, not a real Nether-dimension portal.
5. Meet Ivo. Follow the compass to the marked clue. Read the clue and trial inscription. Ask Ivo about your interpretation; the server checks an answer, guard victory, or evidence-based appeal before opening the first barrier.
6. Face the Sentinel, then the Warden. Both are actual boss entities. You can challenge them, or earn a bargain through the clue, trial artifact, and earlier mercy. Saying “I won” cannot skip them.
7. Reach Elin’s refuge after earning passage. Talk to her, walk with her toward the return gate, and reunite her with Mara. Show the celebration and the chronicle of actual outcomes. Ask Mara about the journey.

A chapter remains committed after construction begins. For a different realm from a clean start, use `./scripts/restart.sh` and reconnect. The script gracefully stops owned services, archives narrative state, and preserves previous worlds. Do not restart during somebody else’s playthrough.

## Explain the technology accurately

Every turn uses the same bounded story-director task: NPC, authoritative quest facts, recent conversation, and inferred player preferences produce dialogue and a structured proposal. The server alone controls evidence, damage, doors, boss outcomes, rescue, and reunion.

The response source matters. `mubit` means a real Mubit response. `openrouter` means the inexpensive text fallback answered after a failed Mubit attempt. `fallback` means deterministic local dialogue. None is proof of a trained adapter. The production story-v2 prompt differs from the legacy adapter’s task; legacy evaluation cannot establish v2 quality.

Show actual request, model, latency and provider evidence if available. Training, deployment, and improvement require independent Mubit evidence; never infer them from a configured key or remembered preferences.

## Recovery

- `/everafter status` gives the next action; the compass points toward it.
- `/everafter home` returns safely. `/everafter go` re-enters the existing chapter.
- Wait for a dialogue before starting another; narration can be interrupted by a new right-click.
- If recognition mishears you, correct it in chat. tiny.en is not an accuracy guarantee in a noisy venue.
- After a backend restart, right-click again to obtain its fresh voice capability.
- Death preserves gear and progress. Reconnecting retains the current server-run quest. Restarting begins a fresh quest.
