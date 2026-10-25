# Corrections

A player can revise their stated preference mid-conversation, and the next Mubit decision reflects the correction — while facts already committed to the world remain untouched. This is the conversational-correction half of the recurring task.

## The turn

Still in the village, the player first asks Mara for a fight:

> **Player → Mara:** "I want to fight whatever took her. Let's do combat."

The decision returned for that turn commits combat:

```json
{
  "route": "combat",
  "chapter": { "realm": "ember_keep", "trial": "gauntlet", "twist": "broken_oath", "title": "The Burning Compass" },
  "preferences": { "combat": true, "mystery": false, "protectVillagers": true },
  "intent": "none",
  "reason": "Player asked for combat; Ember lead chosen."
}
```

One turn later, speaking to Oren, the player changes their mind — and names a different lead:

> **Player → Oren:** "Actually no combat — I'd rather solve the riddle. The drowned page sounds better."

The input's `memory` block now carries the committed preferences, the provisional ones parsed from this message, and the preference history:

```json
{
  "memory": {
    "preferences": { "combat": true, "mystery": false, "protectVillagers": true },
    "provisionalFallbackPreferences": { "combat": false, "mystery": true, "protectVillagers": true },
    "preferenceHistory": [
      {
        "at": "2026-10-25T01:14:02Z",
        "previous": { "combat": false, "mystery": false, "protectVillagers": true },
        "current": { "combat": true, "mystery": false, "protectVillagers": true },
        "evidence": "I want to fight whatever took her. Let's do combat."
      }
    ]
  }
}
```

The returned decision applies the correction end to end:

```json
{
  "route": "mystery",
  "chapter": { "realm": "sunken_archive", "trial": "riddle", "twist": "broken_oath", "title": "The Drowned Record" },
  "preferences": { "combat": false, "mystery": true, "protectVillagers": true },
  "intent": "none",
  "reason": "Player corrected: no combat, prefers the riddle; switched to the sunken lead."
}
```

Every field moved together: `combat` flips false, `route` recomputes to `mystery`, the trial follows the route to `riddle`, and the realm retargets to the lead the player named — `sunken_archive` rather than `ember_keep`. `preferenceHistory` appends the superseded preferences rather than discarding them.

## Where this happens in code

- [`director/director.mjs`](../director/director.mjs) — `preferenceUpdate` parses the message clause by clause so a later clause overrides an earlier one ("instead", "rather", "no combat"); the result is offered to the model as `provisionalFallbackPreferences` alongside the committed `preferences` and the last eight `preferenceHistory` entries.
- [`director/story.mjs`](../director/story.mjs) — `chapterForMessage` rebuilds the chapter when the route changes: `mystery → riddle`, `combat → gauntlet`, `hybrid → parley`, and retargets the realm when the message names a lead.
- [`director/prompt.mjs`](../director/prompt.mjs) — the contract's rule: *corrections revise preferences; history and observed facts remain.*

## What a correction cannot do

Once `areaCommitted` is true or the player is outside the village, route, mood, difficulty and chapter are preserved — a late "actually I want combat" changes dialogue hints only, not the committed chapter. Observed facts (discovered clues, defeated or spared enemies, completed stages) are never revised: corrections reshape what comes next, never what already happened.
