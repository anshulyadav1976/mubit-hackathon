# EVERAFTER demo guide

## Before presenting

Start with `./scripts/start.sh`. Open the director panel at <http://127.0.0.1:8765>, launch the Prism **EVERAFTER** Minecraft instance, and join `127.0.0.1:25565`.

Check the director status before describing a response as AI generated. A configured key does not guarantee successful gateway responses: the source attached to each reply is the relevant evidence. Local fallback is deliberately labelled in Minecraft and remains playable.

Minecraft chat is the dependable input path. For voice, click Speak in the director panel, say your reply, then Stop. Local whisper.cpp fills the editable message box; check it and press Send. Enable Read replies aloud if desired. Confirmed voice transcripts and browser text enter the same dialogue pipeline as chat.

## A short mystery playthrough

1. Arrive at the lantern village. Introduce Mara: her sister Elin is missing. Right-click Mara to select her.
2. Say: “I prefer mystery and puzzles, an eerie atmosphere, and protecting villagers. Please keep it easy.” Wait for her reply. The next-chapter preview shows the route, atmosphere, and difficulty.
3. Right-click Oren and ask: “What should I look for beyond the crossing?” The director receives the player's current preferences and bounded conversation history.
4. Enter the northern arch or type `/everafter go`. The server commits the selected route and assembles its authored scene. Movement begins when construction completes.
5. Follow the compass to the first echo-stone. Right-click its block. Repeat for all three markers. The lights, labels, bossbar, and compass update as each is activated.
6. Follow the compass to Elin. Right-click her to rescue her. Return through the southern arch or type `/everafter home`.
7. Show Elin beside Mara, the changed village decorations, daylight, and the completed objective. Ask Mara: “What will the village remember about our journey?”

## Show preference correction

Before step 4, say: “Actually, I prefer combat instead of puzzles. Make it challenging and wondrous.” Wait for the new preview. Enter the crossing to commit a combat scene. Defeat its Hollow Watchers, speak to Elin, then return home.

A scene cannot be regenerated once committed. To show both branches from a clean beginning, run `./scripts/restart.sh`, then reconnect Minecraft. The script stops both owned services, archives narrative state, and starts a fresh story world. Old worlds and archived state remain intact. There is no browser reset button.

## Recovery during a demo

- `/everafter status` tells you the exact next action.
- `/everafter home` returns safely; `/everafter go` re-enters the existing unfinished chapter.
- A dialogue request is allowed to finish before another is sent. If Mubit is unavailable, the reply carries a local-fallback label.
- If the Minecraft player reconnects, their in-memory progress is retained for that server run. Server restarts begin a fresh quest.
- NPCs cannot be harmed. Gear and quest progress survive death. Story boundaries return the player to a safe path.

## Claims supported by the implementation

The demonstrated loop is conversation → validated chapter choice → actual Minecraft objectives → rescue → village consequence. Geometry and quest transitions are deterministic server code. The model contributes dialogue, route, atmosphere, and bounded difficulty choices through Mubit.

The local preference profile is memory supplied to requests. The optional synthetic request script produces labelled observations and gateway metrics when explicitly run. Neither proves that a shared adapter trained successfully, nor that training improved outcomes. Quote only measured results from an actual report, and distinguish synthetic examples from live player behavior.
