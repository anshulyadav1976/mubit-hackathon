# Track checklist

The [official brief](https://luma.com/nightshift-london) names three tracks. This checklist maps what EVERAFTER implements against each — our own reference for coverage. Checked items are implemented in this repository; unchecked items are remaining evidence work, not missing features.

## Track 1 — Recurring tasks

> Mubit learns a repeated, stable task shape from real usage.

- [x] **One recurring task contract.** Every NPC turn sends the same structured narrative contract — NPC identity, authoritative quest facts, recent conversation, player preferences — and expects bounded dialogue plus a chapter proposal. See [`director/prompt.mjs`](../director/prompt.mjs) and the [story-v2 contract](story-v2-contract.md).
- [x] **Contextual corrections.** Players revise preferences conversationally before a chapter commits; the director re-interprets while preserving history and observed facts. See [corrections](corrections.md) for the turn-by-turn flow; [`director/story.mjs`](../director/story.mjs) and `EverafterPlugin` hold the correction flow.
- [x] **Stable task fingerprint.** The production prompt, model (`gpt-6-luna`) and output schema are frozen; context changes are application state, not weight updates.
- [x] **Candidate corpus collected.** 100 unique story-v2 candidate turns across 25 sessions returned valid story JSON — [submission evidence](story-v2-submission.md).
- [ ] Kept-example review completing in the Mubit console (0 kept, awaiting review at the 00:40 BST 25 Oct checkpoint).

## Track 2 — Own your intelligence layer

> A small, task-shaped model layer you control, evaluated against the generic provider.

- [x] **Structured director contract.** The director owns a bounded JSON schema — route, mood, difficulty, chapter, intent — validated before the game acts. [`director/director.mjs`](../director/director.mjs).
- [x] **Isolated synthetic corpus.** 240 candidate turns / 60 sessions plus 60 held-out turns / 15 separate sessions, frozen with hashes — [preparation record](story-v2-training-preparation.md).
- [x] **Raw-response checks.** 89/100 candidates matched every authored field check; differences retained, never silently repaired.
- [x] **Controlled game execution.** The Paper plugin alone validates stage, evidence, combat and rescue — the model proposes, never executes. See [architecture](architecture.md).
- [ ] Passing task-adapted model serving, with a matched quality/cost/latency comparison against the provider baseline.
- [x] Creator-reported qualitative adapter improvement, recorded honestly in [submission evidence](submission-evidence.md).

## Track 3 — Fast refresh

> Fresh examples produce a new, verified model quickly.

- [x] **Immediate context refresh.** Changed player preferences affect the uncommitted chapter proposal at once — application-level freshness without a paid retrain.
- [x] **Bounded submission runner.** `submit-story-v2.mjs` enforces an exclusive lock, persistent attempt ledger, frozen contract and no blind retries — refresh evidence is versioned and auditable.
- [x] **Dated training checkpoints.** Console observations are recorded verbatim rather than inferred — [submission evidence](story-v2-submission.md).
- [ ] A measured later adapter version with verified serving after fresh examples.

## Criteria coverage

All three tracks inside one application: the recurring director task feeds candidate examples (Track 1), the frozen corpus plus guarded execution form the owned intelligence layer (Track 2), and corrections plus the bounded runner provide the refresh loop (Track 3). See the [review judgment](review-judgment.md) for our scoring of each criterion.
