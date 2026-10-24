# EVERAFTER demo guide

## Before presenting

With Minecraft closed, build and install the native client once with `./client-mod/build.sh` and `python3 client-mod/install-prism.py --minecraft-closed`. Use `./scripts/setup-voice.sh` to install local whisper.cpp/tiny.en on macOS. Start with `./scripts/start.sh --play` and join `127.0.0.1:25565` in the existing Prism **EVERAFTER** instance. No browser is needed for the demo; the optional director panel at <http://127.0.0.1:8765> shows diagnostics.

Check the source shown in the Minecraft dialogue window before describing a response as AI generated. A configured key does not guarantee successful gateway responses: the source attached to each reply is the relevant evidence. Local fallback is deliberately labelled in Minecraft and remains playable.

Right-click a villager to open the Minecraft dialogue window. Click **Record voice**, speak, then **Stop recording**. Review the editable local transcript and click **Send**. The selected NPC's reply appears and plays automatically. Local recognition uses whisper.cpp; hosted NPC speech uses OpenRouter when configured, with macOS `say` as fallback. If microphone permission or audio fails, type in the same field; normal chat and `/talk` also remain available. Tab selects controls, Enter sends from the field, and Escape returns to the world.

The native smoke test recognized “I prefer puzzles and a gentle mystery. Please keep the villagers safe.” exactly after speaker-to-microphone playback, then sent it to Mara and received a Mubit reply. This is one integration check, not an accuracy benchmark. In-game subtitles remain the source of truth if playback fails.

## A short mystery playthrough

1. Arrive at the lantern village. Introduce Mara: her sister Elin is missing. Right-click Mara to open her dialogue window.
2. Record: “I prefer mystery and puzzles, an eerie atmosphere, and protecting villagers. Please keep it easy.” Stop, review the transcript, and Send. Read/listen to her reply. Close the window to see the chat's next-chapter preview showing route, atmosphere, and difficulty.
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
- For a microphone failure, allow access for Minecraft/Java or Prism in macOS Privacy & Security settings, or type directly. If the backend restarted, close the dialogue and right-click the villager again to refresh the local voice token. Speech failure leaves the subtitle intact.
- If the Minecraft player reconnects, their in-memory progress is retained for that server run. Server restarts begin a fresh quest.
- NPCs cannot be harmed. Gear and quest progress survive death. Story boundaries return the player to a safe path.

## Claims supported by the implementation

The demonstrated loop is conversation → validated chapter choice → actual Minecraft objectives → rescue → village consequence. Geometry and quest transitions are deterministic server code. The model contributes dialogue, route, atmosphere, and bounded difficulty choices through Mubit.

The local preference profile is memory supplied to requests. The optional synthetic request script produces labelled observations and gateway metrics when explicitly run. Neither proves that a shared adapter trained successfully, nor that training improved outcomes. Quote only measured results from an actual report, and distinguish synthetic examples from live player behavior.
