# EVERAFTER implementation contract

Local single-player narrative Minecraft Java experience. Paper 1.21.11 / Java 21. All LLM calls go through Mubit. Never claim instant preference memory is a trained adapter. Server listens only on loopback with online-mode=true. No existing worlds are modified.

## Components and ownership
- Game agent: `plugin/pom.xml`, `EverafterPlugin.java`, plugin resources. Paper game events, NPCs, quests, async HTTP calls, polling voice inbox. Own no WorldBuilder.java.
- World agent: `plugin/src/main/java/ai/everafter/WorldBuilder.java` only. Visually distinctive authored/procedural village and two next-area variants, bounded batched edits. No external plugins necessary.
- Director agent: `director/*.mjs`, `director/test/`, `director/package.json`, prompts, synthetic fixtures. No `director/public/` files. Node 22 native HTTP/fetch, no dependencies unless essential.
- Root: runtimes, launcher, startup scripts, UI in director/public, Mubit credentials/training evidence, integration, documentation.

## WorldBuilder API
Package ai.everafter. Constructor `WorldBuilder(JavaPlugin plugin, World world)`.
`void buildVillage(Runnable onComplete)` schedules bounded batches (max ~1500 blocks/tick) on main thread.
`void buildAdventure(String route, String mood, int difficulty, Runnable onComplete)` route `mystery` or `combat`, mood `eerie` or `wonder`, difficulty 1..3. Only first build per run; plugin guarantees no rebuild of visited scenes.
`Location villageSpawn()` around (0,65,0); `Location maraLocation()` around (0,65,-10); `Location orenLocation()` around (-12,65,0); `Location elinLocation()` in adventure; `Location adventureSpawn()`; `Location returnLocation()`.
`List<Location> enemySpawns()`; `List<Location> runeLocations()` (exactly three accessible runes for mystery); `Location gateLocation()` (village portal entrance); `void celebrate()` visible village consequence. `boolean isBusy()`.
World is a superflat dedicated `everafter` world, surface y64, no random vanilla mobs. Village radius <=60, adventure centered x180 radius<=55. Put passable lit paths and directions, deliberate palette/roofs/lighting, towers/ruins, scenic framing. Geometry only; plugin spawns named NPCs, mobs, interactions.

## Director HTTP on 127.0.0.1:8765
`GET /api/health` => {ok,mode,model,configured}
`POST /api/director` {playerId,playerName,message,npc,phase,worldFacts,events?} => {dialogue,route,mood,difficulty,objective,preferences:{combat,mystery,protectVillagers},reason,source,latencyMs,requestId,model,sessionId}. route mystery|combat; mood eerie|wonder; difficulty1..3. npc Mara|Oren|Elin. phase village|adventure|rescued|complete. Dialogue <=320chars, objective<=160. source mubit|fallback. Same stable system prompt, JSON response, changing state in user messages. Safe deterministic fallback on missing credentials/errors, conspicuously labelled. Do not call provider directly. Validate incoming/outgoing shape and constraints. Persist bounded conversation/preferences and metrics in ignored runtime folder. Do not log secret headers. Only data in responses, no generated shell/Minecraft commands.
`POST /api/game-state` {playerId,playerName,phase,route,objective,questProgress,npc, ...} store current game state, visible via state endpoint. No model call.
`GET /api/state` => {game,conversation:[{role,npc?,text,at}],preferences,metrics:{calls,mubitCalls,fallbackCalls,lastLatencyMs,...},...}
`POST /api/input` {message,npc?} queue user text for Minecraft (limit1200chars); no model call here. `GET /api/inbox?playerId=...` drains up to1 message => {messages:[{id,message,npc?}]}; loopback only. Plugin polls every1sec async. All inputs ultimately call same plugin dialogue flow; state UI updates from backend/director.
`POST /api/reset` is a low-level narrative-only endpoint; it does not reset the Minecraft quest and is not exposed as a browser reset button. The supported complete reset is `./scripts/restart.sh`: gracefully stop both owned services, archive stopped director state, and restart into a fresh dedicated world. Prior world directories remain intact. `/everafter reset` directs the player to this script.
Static files from director/public. Browser UI polls /api/state, uses /api/input. `POST /api/transcribe` accepts bounded mono16kHz PCM WAV for local whisper.cpp tiny.en recognition; the browser shows an editable transcript and requires Send before dialogue submission. Optional browser speech synthesis reads replies aloud.

## Gameplay
On first join/ /everafter start spawn village with title, compass/instructions, survival kit. Named villager Mara missing sister Elin, archivist Oren clues. Right-click NPC shows starter dialogue/instructions; normal chat or `/talk ...` goes to selected NPC via director. `/everafter go` or physical gate commits director-selected next area after build. Route preview can change in village before generation starts; generate only on explicit go/gate for reliability. In adventure: combat route defeat bounded undead guards then free Elin; mystery route activate3 visible rune markers then free Elin. Click Elin rescue, return portal /everafter home, village celebrates and NPCs remember. Track progress in bossbar/actionbar, no softlocks, provide /everafter help/status. NPCs protected from harm. Async network, mainthread Bukkit world state only. Game playable with chat if mic unavailable. Use real Mubit as soon as key configured.

## Evidence and budget
No automatic load tests, training loops or paid calls on startup. Synthetic training script explicit manual run, configurable bounded count, distinct sessions, reports honest latency/validation. Root handles actual Mubit calls and console. No secrets committed. Tests should cover constraint enforcement, correction preference, malformed output, gateway errors, path traversal/origin protection, input limits.
