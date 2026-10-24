# Story-led chapter contract

This replaces the two-route rescue demo with AI-directed assembly of authored realms, encounters and dialogue. Describe that honestly; never claim arbitrary generated worlds or verified adapter training.

## Director decision

Retain dialogue (1–320 chars), route, mood, difficulty, objective, preferences and reason. Routes: mystery, combat, hybrid. Mood: eerie, wonder. Difficulty: 1–3. Preferences may have both combat and mystery true.

Add `chapter: {realm, trial, twist, title, hook}`. Realm is `ember_keep`, `sunken_archive`, `sky_monastery`, or `thornwild`. Trial is `riddle`, `gauntlet`, or `parley`. Twist is `broken_oath`, `false_trail`, or `willing_guardian`. Title max64 and hook max160 characters. Backend supplies valid defaults for absent chapter fields and strictly validates supplied fields. Once areaCommitted, preserve chapter as well as route/mood/difficulty.

Add `intent: none|answer|challenge|bargain` and `answer` (0–40 chars). These are proposals, not completed actions. Paper validates stage, NPC, reach, discovered clue/artifact and answer before changing quest state. Model never awards rescue, kills, inventory or world changes.

NPC IDs: Mara, Oren, Elin, Ivo, Sentinel, Warden. Names are stable protocol IDs; visual titles can vary by realm. Existing phases village/adventure/rescued/complete remain. `worldFacts.questStage` adds arrival/trial/sentinel/warden/rescue. Send committed chapter, clue discovery, current riddle, relevant puzzle solution, enemy status, spared/defeated facts and current objective as authoritative facts. Give progressive hints; do not disclose solutions without asking or prior clues.

Mara and Oren offer in-world leads, with questions containing enough context for a new player: a burning compass/ember gate, drowned archive, wind-borne monastery, or living thornwood. Ask which lead sounds plausible and what approach feels right; do not expect a player to announce abstract preferences. Interpret vague replies. After commitment, adapt hints, dialogue and permitted encounter choices rather than replacing the visited realm.

## WorldBuilder API (world agent owns)

Keep existing APIs as wrappers where required. Add:
- `buildChapter(String realm, String trial, String mood, int difficulty, Runnable done)`
- `guideLocation()`, `trialLocation()`, `sentinelLocation()`, `bossLocation()`, `clueLocation()`
- `riddle()`, `solution()`, `clueText()`, `realmName()`
- `unlockStage(int stage)` for visible barriers (1 trial cleared; 2 sentinel cleared; 3 warden cleared).

Retain villageSpawn/maraLocation/orenLocation/gateLocation/adventureSpawn/returnLocation/elinLocation/enemySpawns/runeLocations/celebrate/isBusy. Four visually distinct authored realm assemblies, with clue/trial, miniboss, final boss and Elin's refuge. No mandatory three-stone clicking. A trial inscription plus NPC answer is a real riddle path; gauntlet is a guard wave; parley is an evidence-based conversation. Ensure walking paths, accessible arenas and bounded edits. Ember Keep is explicitly Nether-themed unless implemented in an actual Nether dimension.

Suggested progression along z: arrival/guide +26, trial +10, sentinel -5, warden -23, Elin -40; world agent may adjust but must return correct locations. Plugin and builder share those returned positions, never guessed coordinates.

## Authoritative quest (game agent owns)

On commit, create selected realm and spawn Ivo, miniboss Sentinel, final boss Warden and Elin. Trial -> Sentinel -> Warden -> Elin -> escort/reunion. Bosses must be actual distinct combat entities with health/progression and visible mechanics, not renamed ordinary guard waves. Guard/puzzle/parley approaches use validated stage and evidence. A bargain may spare a boss only with actual required clue/artifact/prior outcome. Record decisions for personalized ending. Damage/death/reconnect must remain recoverable.

Mara/Oren patrol short routes and face nearby players; pause wandering during conversation. Ivo can guide; rescued Elin physically follows the player and reunites with Mara at home. Do not use setAI(false) for all story characters permanently. Protected friendly NPCs remain safe. Add bounded, readable TextDisplay dialogue bubbles above speakers, tracking movement and expiring. Short names replace enormous instructional name tags. Finale: visible reunion, voiced lines, celebration and a factual personalized chronicle/reward.

## In-world voice (root owns client and speech backend)

Existing right-click recording and correlated Say/Reply remain. Root fixes playback and adds `everafter:scene`, a VarInt UTF-8 JSON S2C payload `{version:1,npc,entityId,playerId,backendToken,dialogue,source}` for scripted, proximity and typed-chat NPC speech. Verify local server, player, NPC and nearby entity. Do not interrupt active recording/pending dialogue with unsolicited narration. Otherwise play scene voice with subtitles; right-click can interrupt to speak. No secondary screen.

Game agent registers scene channel and supplies token just as OPEN does. Use scene packets for scripted/proximity/reunion speech and typed-chat replies; correlated voice replies use REPLY. Avoid duplicate speech for one utterance. NPC bubbles are server TextDisplays. Root extends voice allowlist to all six protocol NPCs, uses reliable Mac speaker playback and verifies physical output via microphone loopback. No provider keys in game packets.

## Ownership

Director agent: director.mjs, prompt.mjs, new story catalogue/tests and cheap inference fallback if required. Do not edit speech.mjs, voice.mjs or server.mjs without coordinating with root. Preserve original recovery artifacts; no training batch while contract changes. Production v2 prompt is a new task, not evidence that old v1 adapter improved.
World agent: WorldBuilder.java and its geometry tests. Game agent: EverafterPlugin.java, plugin resources and gameplay tests. Root: client-mod, speech/voice backend, integration, launch and docs. All share filesystem; no commits or runtime changes by agents. Run relevant tests and report exact API/behavior.
