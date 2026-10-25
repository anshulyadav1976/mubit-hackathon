# Story-v2 submission evidence

The user authorized new story-v2 candidate submissions on 25 October 2026 (Europe/London) and paused the recurring Mubit monitor. This is a separate task from the legacy adapter: its three-NPC prompt does not match the current six-NPC story director.

## Completed batch

Submission finished at **00:19 BST on 25 October 2026** (23:19 UTC on 24 October).

| Observation | Result |
|---|---|
| Unique candidate turns with valid story JSON | 100 across 25 sessions |
| Gateway attempts / HTTP 200 responses | 101 / 101 |
| Truncated answer, subsequently recovered | 1 |
| Exact raw authored-field matches | 89 of 100 valid responses |
| Valid responses with authored-field differences | 11, retained without correction |
| Returned total tokens across both runs | 266,191 |
| Held-out turns submitted | 0 |
| Cumulative recovery budget | 197 of 200 attempts; all 3 rounds used |
| Mubit kept examples / training / passing / serving | Unknown / unverified |

The continuation run `story-v2-9f881f24-9a78-474b-8a5e-0584d89350a9` completed all 94 planned requests. Together with the first six valid outputs, this establishes 100 unique valid responses. Its predecessor's empty answer is retained as a failed attempt. The local field score concerns teacher responses on authored candidate inputs; it is not a held-out evaluation, a trained-adapter score or an acceptance count. No further paid round is scheduled or allowed by this ledger. The local aggregate is `director/runtime/training-recovery/story-v2-submission-summary.json`.

## Subsequent console observation

At **00:40 BST on 25 October 2026**, an authenticated read-only inspection of [Narrative director of EVERAFTER 2](https://app.mubit.ai/console/projects/ws-4f30c2c7f67f9351/workloads/ln_0958f4c72a83f14c91fb4b6d) showed **153 usable calls, 0 kept, 0 rejected, 153 awaiting review, 153 queued, 19 reviews running, and 0 over the daily review limit**. First training was **not started**; its threshold was 25 kept examples, sessions with kept examples were 0, and routes were none. The earlier unknown statuses in the completed-batch table describe the API-only submission checkpoint, not this later console observation.

The console's task-wide 153 calls include traffic outside this 100-turn candidate batch. They are not 153 accepted training rows. Its only listed adapter remained the legacy Qwen3-4B v1, with a `Prompt only` training result, 0% across 12 scored cases, and no linked request path. No settings were changed and no further provider calls were made for this inspection. The cause of the unfinished reviews was not established; this snapshot does not establish a permanent outage or later training outcome. The private observation is `director/runtime/training-recovery/manual-status-latest.json`.

## What is sent

`director/submit-story-v2.mjs` selects 100 candidate turns from 25 complete synthetic conversations. Coverage includes four realms, all six NPCs, five quest stages, three trial types, preference corrections, evidence gates and completed-story memory. The 60 held-out turns are never submitted. The frozen corpus, production prompt/model/response format and live player profiles are unchanged.

Each submission is a normal provider call through `https://api.mubit.ai/openai/v1/chat/completions`, using `gpt-6-luna` and the production JSON contract. Authored expected fields are used for local checks; they are not sent as replacement model replies. Mubit decides whether to keep a call and when to train. This runner does not invoke an undocumented training endpoint.

## Bounded execution

The runner shares the existing persistent 200-attempt ledger and exclusive lock. The initial legacy batch used 96 attempts and one round. Every new attempt is reserved before the request; the runner stops on an HTTP, transport, truncation, JSON or schema error without automatic retries. Ordinary reruns refuse previously submitted story-v2 work. Raw field differences are reported separately from schema validity and are never silently repaired by game guards.

The first story-v2 run stopped after six valid outputs when the seventh exhausted its 600-token completion allowance entirely on reasoning. Its HTTP response was 200, `finish_reason=length`, with no answer text. A preserved, explicit feedback plan permits only that failed case and the remaining 93 unattempted cases, using a 2,048-token allowance. Successful calls are not replayed. The continuation is the final third round; it preserves the model, instructions, output format and session context. This is a response-budget correction, not a model weight update.

Private evidence stays Git-ignored under `director/runtime/training-recovery/`: the initial `story-v2-435090e6-250d-4b37-9876-b155a4d3523d/report.json`, `story-v2-truncation-feedback-20261025.json`, the continuation report referenced by `story-v2-latest.json`, and the shared `call-ledger.json`. The legacy `latest.json` and original reports remain historical evidence.

## Commands and checks

Run from the repository root. The default command is offline and verifies the frozen corpus:

```sh
node director/submit-story-v2.mjs --count 100
node --test director/test/*.test.mjs
```

The authorized live invocation used Node's ignored local environment file, without placing credentials in arguments. The narrowly scoped continuation requires an explicit `--feedback` file; it validates the source report hash, exact failed and unattempted case IDs, unchanged task fingerprint, ledger linkage and remaining budget before sending. It refuses successful-case replays, held-out cases, changed output limits, overlapping workers and additional rounds. It is not an automatic recovery loop.

All **68 director tests** passed before the continuation. These tests cover submission selection, offline defaults, frozen artifacts, actual CLI argument handling, reservation/lock/cap rules, no-retry failures, raw checks, explicit feedback and output-limit-only request changes. They do not establish Mubit curation or adapter quality.

## What remains unverified

The current public [API reference](https://docs.mubit.ai/reference/api) documents provider inference routes, but no task/adapter-training status endpoint. SDK 0.14.0rc1's CLI probes older `/v2/loop` and health routes, which return 404 on this gateway. Those absent routes are not an inference outage. A fresh model-listing check returned HTTP 200; actual story replies provide stronger inference evidence.

The [first-adapter guide](https://docs.mubit.ai/guides/first-adapter) distinguishes submitted calls, kept examples, training, testing, passing and comparison. Kept counts, training progress, a passing adapter and adapter serving remain unknown through the available API/CLI. Local schema checks and comparisons with authored fields establish none of those states. This candidate set is not an independent model benchmark or a cost/speed improvement measurement.
