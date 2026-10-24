# Story-v2 examples saved for later

> Historical preparation record: the manifest and counts below describe the saved corpus before submission was authorized. The user subsequently authorized [separate story-v2 CLI submissions on 25 October](story-v2-submission.md). Frozen artifacts are preserved; their `submitted: 0` field is not a current account-wide submission counter.

These files are **prepared and locally validated only**. They contain authored synthetic requests, hypothetical game snapshots and golden field targets. They contain no provider completions, real player traces, model-quality measurements or Mubit acceptance evidence.

| State | Value |
|---|---|
| Candidate inputs | 240 turns / 60 independent four-turn sessions |
| Held-out evaluation inputs | 60 turns / 15 separate four-turn sessions |
| Submitted | **0** |
| Mubit kept examples | **Unknown** (`null`) |
| Future kept-example target | **50**; submissions do not guarantee this |
| Paid inference / training / settings changes | **None** |
| Submission authorization | **Not granted: save now and send only after a future explicit request** |

The offline preparation tool has **no submission code**. `--live`, `--run`, `--submit` and other unknown arguments are refused. No provider credential is read. No new SDK or importer was added. Nothing in this preparation starts a training job or changes its lifecycle.

## Saved artifacts

- `director/fixtures/story-v2/candidates.json`: frozen candidate requests, prior authored conversation, observed-state fixtures, expected fields and evidence conditions.
- `director/fixtures/story-v2/heldout.json`: independent evaluation sessions; keep these out of future recorded training traffic.
- `director/fixtures/story-v2/prompt.json`: exact production story-v2 system prompt, `gpt-6-luna` model and `json_object` response format.
- `director/fixtures/story-v2/manifest.json`: provenance, preparation state, source hashes and artifact SHA-256 hashes.
- `director/fixtures/story-v2/validation.json`: exact coverage and offline self-consistency checks.
- `director/fixtures/story-v2.mjs`: the separately authored candidate/held-out banks and deterministic assembly.
- `director/prepare-story-v2.mjs`: offline verification/preparation and reusable raw field checks.

Production task fingerprint: `f1fe357e44de6f68e518734ea0b2e23afca77d7841f04583e3ba9d84e77aa5df`.

Manifest SHA-256: `5c5cbe50aff7ba4d297b46172e9b1caec9f9c36bf25e0ee1b5673d6c6514b514`.

Candidate SHA-256: `da66582630fb2f8e1d6b59fc4a3ff23fdb2248c191ff125ca8fa113945e3343b`.

Held-out SHA-256: `efa4d321737ee18b5fd42a07bf428f44142c96b626e3dc98442a97e7689959a5`.

The tool checks the exact prompt/model/format fingerprint. Drift requires a new reviewed dataset version. It refuses silently overwriting changed frozen files, including with `--write`.

## Coverage

The candidates cover all **36 realm × trial × twist combinations**, all six NPC IDs, all four phases, all five quest stages, all three routes and all four intent values. Realm counts are exactly 60 each. Actual turn counts reflect planning corrections, so trial and twist counts are deliberately reported from the generated data rather than assumed equal.

| Dimension | Candidate turns | Held-out turns |
|---|---|---|
| Trial | riddle 68 / gauntlet 76 / parley 96 | riddle 17 / gauntlet 21 / parley 22 |
| Twist | broken oath 72 / false trail 88 / willing guardian 80 | broken oath 18 / false trail 20 / willing guardian 22 |
| Route | mystery 68 / combat 72 / hybrid 100 | mystery 17 / combat 19 / hybrid 24 |
| Phase | village 64 / adventure 144 / rescued 12 / complete 20 | village 16 / adventure 36 / rescued 3 / complete 5 |
| NPC | Mara 44 / Oren 36 / Elin 24 / Ivo 68 / Sentinel 40 / Warden 28 | Mara 11 / Oren 9 / Elin 6 / Ivo 17 / Sentinel 10 / Warden 7 |
| Intent | none 200 / answer 8 / challenge 8 / bargain 24 | none 50 / answer 2 / challenge 2 / bargain 6 |

The authored scenarios include context-only lead choices (“the wet one”), acknowledgements, preference reversals and final negations, hybrid preferences, committed chapter/route/mood/difficulty locks, missing witness evidence, a failed Warden bargain after the Sentinel died, false victory claims, escort versus reunion, and completed-history preservation. Hypothetical progression between turns is explicitly supplied by the fixture author; no model answer is credited with changing the world.

Candidate and held-out banks use different utterance templates and NPC seed questions, disjoint session IDs, and no exact or normalized utterance-template overlap. Shared public story canon and the production schema are intentional. This does not prove statistical independence: these are small authored test families with some shared underlying scenarios, not a representative sample of players.

## What offline validation establishes

All 300 inputs pass production input validation. Authored schema-check references pass decision validation and golden-field checks. These references are generated only to test the checker; they are **not** saved or described as model replies.

Checks cover deterministic counts, all 36 combinations, NPC coverage, session/split isolation, monotonic observed facts, consistent phase/stage snapshots, committed chapter preservation, answer evidence conditions, the stable first session message, bounded request context and exact production prompt/format. The raw checker compares routes, mood, difficulty, preferences, intent, answer and chapter IDs; after commitment it also compares chapter title/hook. It rejects extra world-mutation claims instead of allowing backend guards to hide them.

`expected.objective` is an authored state reference. Dialogue/reason/objective wording is not scored by exact prose matching. Factual dialogue, NPC voice, unwanted solution disclosure and the interpretation of ambiguous language still require human review of any future model responses. The rare answer/challenge groups are too small for a broad reliability claim; report per-class counts and macro-F1 rather than relying on overall accuracy.

## Offline commands

Run from the repository root:

```sh
node director/prepare-story-v2.mjs
node --test director/test/story-v2-preparation.test.mjs
node --test director/test/*.test.mjs
```

The first command verifies the existing frozen files without writing or networking. `node director/prepare-story-v2.mjs --write` can create missing preparation files, and accepts existing identical files; it refuses replacement when contents differ. It is not a training command.

## Later submission boundary

Sending remains a separate future action. A future runner needs a fresh explicit user request and bounded attempt/token/dollar budget, a persistent ledger and exclusive training lock, exact fingerprint checks, OpenRouter disabled, raw response checks, per-attempt usage/IDs, checkpoints and stop-on-error behaviour. It must use isolated synthetic profiles and never alter the live game. No such runner is included in this preparation.

Preserve the legacy recovery ledger at **96/200 attempts, round 1/3**. Its SHA-256 remains `6564c885df347c7826ebecfcc22466630ed50cd148cc567bb26df88c2831bc9c`. The legacy dataset's label “recovery-v2” predates the story-v2 contract and does not make it compatible. Existing legacy live guards remain intact; do not reset that ledger or resume that batch.

After any future authorized submission, only actual Mubit task counters can establish kept-example progress. Fifty kept examples would still not prove fifty training rows, a particular Qwen foundation, a passing adapter or adapter serving. Verify each separately. Gateway task grouping, training and comparisons are documented in [tasks and sessions](https://docs.mubit.ai/guides/tasks-and-sessions) and [first adapter](https://docs.mubit.ai/guides/first-adapter). These files are not an undocumented direct-upload format.
