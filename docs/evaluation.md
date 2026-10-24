> **Story v2 contract boundary (24 October 2026):** Production uses the story-led chapter prompt with four realms, three trials, three twists, six NPCs, hybrid routes, and intent/answer proposals. This is a new Mubit task fingerprint. All recorded live measurements and hosted-adapter observations below describe the earlier rescue-demo prompt; they do not establish v2 quality, serving, or improvement. Current story text uses Mubit, followed by a labelled deterministic local fallback (`source=fallback`) when unavailable or invalid. OpenRouter is used only for optional hosted TTS, never as an alternate story-text inference provider. Legacy synthetic/recovery paid runners and the legacy live evaluator refuse v2 before requests or ledger changes; their reports and 96/200-attempt, round-1 ledger remain historical evidence. The [saved v2 preparation](story-v2-training-preparation.md) contains 240 candidate turns and 60 held-out cases, locally validated only: submitted **0**, kept **unknown**, future kept target **50**. Sending them requires a separate future explicit request and bounded budget.

# Reproducible evaluation and training evidence

**25 October update:** [Story-v2 submission evidence](story-v2-submission.md) records the separately authorized live candidate batch and its response-limit recovery. The preparation-only counts in the historical contract-boundary note above predate that run. HTTP responses and local checks do not establish Mubit-kept examples, training, passing or adapter serving.

The evaluator contains 20 authored synthetic cases: 12 explicit preference/correction cases and eight committed-route or quest-phase cases. They are separate from the 40 synthetic training utterances. Each evaluation case uses a distinct Mubit session; correction cases seed a labelled synthetic prior preference and conversation without making extra requests. These are test fixtures, not real player observations.

## Offline checks

```sh
node --test director/test/*.test.mjs
node director/evaluate.mjs
```

A historical legacy automated-validation snapshot recorded **31 passing Node tests, 9 passing Java tests and 12 passing Python tests**. These are historical counts, not the current suite totals. The Node total includes the recovery coverage, raw-decision, persistent-budget, concurrency and bounded-option regressions. These checks are separate from the native Minecraft UI observations below.

The default evaluator deliberately supplies an empty API key even if your environment has a key. It makes zero gateway requests and writes an `offline-fallback-validation` report under ignored `director/runtime/evaluations/`. It tests local fallback behavior, schema bounds, quest objectives, route locks and correction handling. Offline scores say nothing about Mubit training or model quality. Failed expectations are reported as failures rather than removed.

## Recorded offline measurements

The preserved `director/runtime/evaluations/offline-validation.json` report contains 20 authored synthetic cases, completed with **zero Mubit requests** and 20 local fallback responses. It records 20/20 bounded-constraint checks, 11/12 explicit route preferences, preference micro-F1 0.9167, 8/8 committed-route checks, and 8/8 phase-objective checks. Its `correct-action` miss was “Forget my old puzzle preference. I want combat now.”: the fallback let the earlier puzzle mention override the later correction.

After changing the shared fallback/provisional parser to apply preference clauses in order, a separate `director/runtime/evaluations/offline-correction-fix.json` run of the same 20 fixtures records 20/20 bounded constraints, 12/12 explicit route preferences, preference micro-F1 1.0000, 8/8 committed routes and 8/8 phase objectives. It also made **zero Mubit requests**. Regression tests cover that exact correction, the inverse, final negations, preserved history and successful Mubit decisions remaining authoritative. The prior failure report was not overwritten. These measurements demonstrate a deterministic parser fix on these synthetic cases; they are not trained-model metrics or evidence of adapter improvement.

The local voice path also has a speaker-to-microphone smoke check: one spoken sentence was recognized exactly by whisper.cpp tiny.en. That single observation is not a speech-recognition benchmark, and the director evaluator does not exercise audio.

## Historical text-routing configuration

Earlier on **24 October 2026**, before the current routing cleanup, the implementation note described a bounded OpenRouter story-text fallback using `google/gemini-2.5-flash-lite`. Its presence, JSON-format support and listed $0.10/$0.40 per-million input/output-token prices were checked against the [public catalogue](https://openrouter.ai/api/v1/models). That note did not report a paid text-inference verification. This is dated configuration research, not the current story-text route, a model-quality measurement or Mubit training evidence. The alternate story-text route has been removed; OpenRouter remains available only for hosted TTS.

## Recorded live provider baseline

After the session compatibility fix, the authorized `director/runtime/evaluations/baseline-live-2026-10-24.json` run completed all 20 synthetic cases with `gpt-6-luna`: **20 Mubit responses, zero fallback responses, zero errors**, 20 distinct sessions and 20 middleware request IDs. The operator reported inspecting the console before this run and finding no adapters; that manual statement is recorded in the report, not independently verified by the runner. No synthetic training runner had been executed at this point.

| Measured result | Live provider baseline |
| --- | --- |
| Guarded constraints | 20/20 |
| Explicit route preference | 12/12 |
| Preference micro-F1 | 1.0000 |
| Committed route | 8/8 |
| Phase objective | 8/8 |
| End-to-end median / p95 latency | 2,499.5 / 3,379 ms |
| Returned prompt / completion / total tokens | 17,868 / 4,867 / 22,735 |

The first and last middleware IDs were `mreq_01a16e417f687103ab44ba02d5f82205` and `mreq_01a16e4239b07773b89ff06291f47dc2`. This is the provider baseline, not an adapter result. Constraint/route-lock/objective scores include backend guards, while explicit preference decisions came from validated model responses. The preference cases already score perfectly, so they provide no headroom to claim a later F1 increase. Mubit kept-example counts, eligibility, training progress and adapter serving still require separate console evidence. Preserve this report and pass its actual path to `--compare` for any later matching live run.

The operator then observed the actual Mubit console task `ln_f033afe97baac3c175b28c3f`, task key `lk1_09b1679beae4f3a37e3e1216a20baf0f`. Before the separate synthetic batch, its console showed **21 waiting review, 0 kept, 0 rejected, no training and no routes**. This agrees with one successful compatibility confirmation plus 20 baseline requests, but also demonstrates why successful HTTP calls must not be described as retained training examples or an adapter. These counts are an operator-observed console snapshot at that point, not an automatic check by the evaluation runner.

In a later operator-observed console snapshot on 2026-10-24, after the 40-request synthetic batch and live gameplay, the task showed **64 calls, 62 usable, 0 kept, 0 rejected and 62 waiting review**. Its review counters showed **62 queued, 0 over limit and 5 running**; the first adapter training had **not started**. These are the console's observed counters, including its separate queue/running labels, not counts inferred from successful client requests. Review work was now visible, but no trained adapter, passing version, adapter-served request or improvement had been established at this snapshot.

At **16:02 BST on 2026-10-24**, the console still showed **0 kept, 0 rejected and first training not started**. It reported 63 usable calls, 64 waiting review, 63 queued, 0 over the daily limit and 6 running. The header displayed 65 calls while seven-day traffic displayed 70; these inconsistent aggregates are preserved as displayed, not reconciled into a claimed total. The routing explanation said no version was on a silent test, partial rollout or live.

The subsequent console check displayed **“The engine is not answering” / “Engine unreachable”**, including after one retry. This is evidence about the console's engine connection, not proof that the inference gateway was also unavailable. No further synthetic calls were made at that point.

### Provider follow-up

The initial diagnostic for the [EVERAFTER task](https://app.mubit.ai/console/projects/ws-4f30c2c7f67f9351/workloads/ln_f033afe97baac3c175b28c3f) was a review queue with no kept/rejected examples. **That zero-example state is historical: review progress resumed during the later check below.** No cause was established, no quality gates were weakened, and no support message was sent automatically. A passing adapter, serving evidence and a matching application-level post-training evaluation remain outstanding.

### Recovery check, 16:39–16:43 BST

After the user relayed the CTO's request, the [first-adapter guide and recovery section](https://docs.mubit.ai/guides/first-adapter#waits-and-recovery) were re-read. They specify first training at 25 kept examples, not more than 25 raw calls. New messages can recover a failed training, but this task did not show a failed training. Read-only settings inspection confirmed:

- `adapters.train=true`; first-training minimum `adapters.min_rows=25`.
- New versions after 25 new examples (`adapters.refresh.min_new_rows=25`), a retraining threshold distinct from the first-training minimum.
- The user-facing Training limit says **No daily limit**; `adapters.daily_job_budget=0` must not be described as a zero-job allowance.
- No task-specific overrides; `judge.curation=off` still appeared as Middleware-locked. Its internal meaning is unverified, and the kept-example progress below shows it is not evidence that all review is disabled.

Before any new request was sent, the task changed from zero to **20 kept examples**, with 1 rejected and 47 waiting for review, 68 usable calls, 6 reviews running, 0 over today's limit, and first training not started. Service status was Operational. The recovery therefore cannot be attributed to the subsequent request.

One fresh, user-authorized synthetic preference-correction example was sent using the unchanged production model/prompt/format in an isolated in-memory Director, leaving the live game untouched. At **16:40:31 BST**, it returned a valid mystery/eerie/difficulty-1 decision in **2,479 ms**, with 785 prompt and 199 completion tokens, no fallback/error, and middleware ID `mreq_01a16e9211ed7c439e810ee5b0ccc910`. Evidence: ignored `director/runtime/diagnostics/recovery-a83f02f5-a9e1-4c28-88f2-acbafb0505cc.json`. This is a submitted call, not a claim that this particular example was kept or trained. No settings were changed and no batch or retry was run.

At **16:43 BST**, the same task visibly changed to **Training / Training v1**, with first training **started just now**, job `ftjob_7b85f04e`. Details showed **38 kept, 1 rejected, 6 waiting for review and 23 couldn't be reviewed**, across 29 sessions with kept examples. There were no serving routes and no test result yet. The console still displayed 70 calls, so the new request's appearance in those aggregates was not established. The earlier review blockage is no longer the current state: the first training run has started. This does not establish a completed adapter, a passing evaluation or serving; it also does not establish that the one added request caused training to start.

### First version result, inspected after 17:08 BST

The console created adapter `ad_lane_a96a2bdc`, version **v1**, at **16:48:45 BST**, based on `Qwen/Qwen3-4B-Instruct-2507`. The completed run returned **Prompt only / Not ready yet**, not a passing adapter. Its version-specific training-example count was not reported; the task's 38-kept snapshot must not be presented as the exact training split.

A later read-only check confirmed the same result. The evaluation's Why tooltip says its stored provider replies are the answer key. The UI still does not expose the exact failing per-field checks. The visible Training controls offer a new-example threshold, maximum example length and organization training limit; Adapters offers the quality gap and minimum judged-case count. Neither exposes an adapter-foundation selector. Advanced lists `census.bases` as `Qwen/Qwen3-4B-Instruct-2507, Qwen/Qwen3-8B`, but no inspected documentation or visible control establishes this as a supported selector for the adapter's training foundation. Changing the requested provider model would form a different task, not prove that the hosted adapter foundation changed. No base settings or pass gates were altered. See the [first-adapter guide](https://docs.mubit.ai/guides/first-adapter) and [task/model grouping](https://docs.mubit.ai/guides/model-ids). Hosted training uses provider compute; local CUDA availability does not determine the hosted base.

Mubit's test set `gs_r4_ck7ad45aafa4fbda7a` contains 12 required held-out cases. It reported **adapter 0/12, base model plus prompt 0/12, target 95%**, with a separate minimum of **20 judged cases** for going live. Recorded provider answers are marked pass per case; the aggregate provider-model row says not measured, so this is not a fresh three-model benchmark. The release explanation cited the failed verdict, insufficient case count and no improvement over the base. Try it was disabled and no request path pointed to the adapter.

Three displayed failed response pairs were inspected. Both sides returned structured narrative decisions. The third pair agreed on route `combat`, mood `eerie`, difficulty `2` and all three preference flags, while dialogue/objective/reason wording differed. The first two pairs also differed on mood. The UI did not expose the exact per-field grading rubric or input with these replies; this is insufficient to conclude the grader is wrong or that prose comparison caused the failures. The next diagnostic for Mubit is to inspect the failing conformance checks for this test set before choosing targeted training data. No additional calls or settings changes were made in this inspection.

## Native Minecraft gameplay check

A separate native Minecraft UI playthrough completed the **mystery route**: all three rune markers were right-clicked, Elin was right-clicked to rescue her, and `/ea home` returned to the village and triggered the celebration with Mara and Elin. This checks the actual mystery quest transitions and visible village consequence beyond the director's synthetic HTTP cases. This single mystery playthrough is not a broad gameplay, accessibility or generated-world-quality benchmark.

A partial **combat-route** native UI check used a live Mubit decision to generate a watchtower chapter with five guards. Player damage, death and automatic respawn with preserved gear were observed. Attack testing through the UI controls was inconclusive, so clearing the guards and completing the combat rescue were **not verified**. The standard left mouse button attack binding was restored after the temporary input test. A fresh server and client were running at the end of the check.

## Explicit live evaluation

Only `--live` enables paid Mubit calls. Supply `MUBIT_API_KEY` securely through the local process environment or ignored root `.env`, and keep the same `MUBIT_MODEL` throughout a comparison. The commands below explicitly load `.env` when present; importing the director or running a plain Node command does not load it automatically.

```sh
node --env-file-if-exists=.env director/evaluate.mjs --live --label baseline --output director/runtime/evaluations/baseline.json
```

A full live evaluation makes at most 20 sequential gateway requests. `--count 1` through `--count 20` limits a smoke test. The runner stops on the first fallback and marks that run incomplete. It never retries automatically. The director has a separate bounded request budget and timeout. All requests go to `https://api.mubit.ai/openai/v1/chat/completions` with the same production system prompt and response format. A stable first user message carries a per-case session UUID and player ID; Mubit documents deriving a session from the instructions and first user message when metadata is absent. Changing state follows in a separate user message. The report records true gateway IDs from `x-middleware-request-id` (falling back to `x-request-id`), local request IDs, source, latency and returned token usage. Missing usage stays unknown rather than being invented.

Both training and evaluation reports record the response format and a local SHA-256 fingerprint of the model/system-prompt/format tuple. This lets you check that the client task stayed stable; it is not the provider's own task identifier or proof of an adapter.

The current official [OpenAI connection guide](https://docs.mubit.ai/guides/connect-openai) uses this gateway and `gpt-6-luna`; [model IDs](https://docs.mubit.ai/guides/model-ids) explains account-specific starter-credit restrictions. The director sends `response_format: {type: "json_object"}` and a bounded `max_completion_tokens`. An authorized single-case confirmation succeeded on this account after the session workaround below: HTTP 200, a validated Mubit decision, 2,312 ms, and 900 prompt / 216 completion / 1,116 total returned tokens. Evidence is retained in ignored `director/runtime/evaluations/live-confirmation-4.json`, with middleware ID `mreq_01a16e4114747ed1b9f8ea36a08dd22e`. This is a compatibility smoke check, not adapter-training evidence. No automatic retry changes the model or output format and silently splits the task.

Authorized diagnostics exposed incompatible options on the starter credit: the provider requires `store` for `metadata`, while Mubit returns `starter_credit_option` when `store: true` is supplied. The director now omits both fields and uses the documented first-user-message session fallback, preserving the same task prompt/model/format without requesting provider-side stored completions. The failed diagnostic and attempted confirmation remain in ignored `director/runtime/diagnostics/gateway-error-2.json` and `gateway-confirmation-3.json`, alongside their incomplete evaluation reports. The later successful confirmation used this workaround; request-shape/session-isolation regression tests also pass.

Before calling a run a baseline, manually inspect the Mubit console and record the task fingerprint and adapter state. A previously trained task is not an untrained baseline merely because the report says `baseline`.

## Training and a later comparison

The explicit training runner makes at most 40 requests against the same production task prompt and output format, in eight separate synthetic player sessions. It stops on the first fallback. It does not independently launch a fine-tuning job or prove Mubit kept examples, trained an adapter or routed a request through one.

```sh
node --env-file-if-exists=.env director/train-synthetic.mjs --run --count 40
```

The authorized recorded batch `director/runtime/synthetic-training/synthetic-0b1286cf-4cc5-417c-ad0b-c86673e34378/report.json` completed **40 Mubit requests, zero fallback responses and zero errors**, across eight synthetic sessions, with all 40 middleware IDs retained. Returned usage was 43,903 prompt / 8,785 completion / 52,688 total tokens. End-to-end latency was 2,211 ms median, 3,178 ms p95 and 5,770 ms maximum. Its local prompt fingerprint exactly matches the live provider baseline (`6a9d76c14edc86cf8cf94c005ed2c09c08ddb15564433f6d5f691ceb2c3dac21`). These latency measurements describe a different synthetic request set and are not a before/after training comparison.

The actual validated responses included 13 within-session route changes. In scenario 1, “Actually I want combat instead.” changed mystery to combat, and “I changed my mind: no combat, I prefer puzzles.” changed it back to mystery. In scenario 8, “I prefer combat instead of puzzles.” selected combat, followed by mystery after “Actually, I prefer mystery, no combat.” These observations demonstrate preference interpretation in the provider responses; they do not establish adapter learning. No post-adapter evaluation was run with this batch. New kept-example counts, training state and routing must be observed in the console rather than inferred from the 40 successful requests.

Inspect the Mubit console afterward. Save concrete evidence of the task, kept-example count, training status, adapter identifier/version and any inference routing evidence the console exposes. Report missing evidence as missing. Do not equate the local `mubitCalls` count, successful HTTP responses, or ordinary preference memory with retained training examples or a trained adapter.

After the console shows the state you intend to measure, repeat the same evaluation:

```sh
node --env-file-if-exists=.env director/evaluate.mjs --live --label post-training --console-evidence "Manually recorded console evidence: path or description" --compare director/runtime/evaluations/baseline.json --output director/runtime/evaluations/post-training.json
```

The evidence text is an operator-provided reference, not automatic verification. A comparison requires complete live runs with matching model, system prompt, response format and fixtures. It reports observed score/latency deltas. Twenty synthetic examples, changing service conditions, sampling variance, hidden provider routing and a manually observed adapter state cannot establish a causal improvement from training. Preserve unsuccessful runs too.

## Bounded diverse recovery workflow

`director/fixtures/recovery.mjs` contains 96 distinct authored synthetic messages across 24 independent four-turn sessions: 36 village, 24 adventure, 12 rescued and 24 complete examples; Mara, Oren and Elin are represented, with 48 intended mystery and 48 combat decisions. Twelve planning corrections and 60 committed-phase cases cover route locks, progress, rescue/home facts and command/fact boundaries. Offline validation checks every input and fallback output shape; it does not claim those are model observations. Live reports retain raw model replies and check their shape, intended route and villager protection before backend guards can hide a failed route lock. Those checks are narrower than a human review of dialogue or Mubit's undisclosed conformance rubric.

```sh
node director/train-recovery.mjs
node director/recovery-status.mjs
```

Both commands above make zero paid requests. The explicitly authorized initial batch is:

```sh
node --env-file-if-exists=.env director/train-recovery.mjs --live --count 96
```

Recovery state is durable under ignored `director/runtime/training-recovery/`: `latest.json` points to the current run and report; `call-ledger.json` counts cumulative recovery attempts, including uncertain transport outcomes; each `recovery-<uuid>/report.json` is checkpointed after every response. The initial live run is `recovery-4273db42-d53a-489f-9dae-1f5d7a29c5d7`. A whole-run exclusive `call-ledger.json.lock` prevents a batch and heartbeat from overlapping. The 200-additional-call cap persists across process restarts, with at most three total recovery rounds including the initial batch. Reservations are written before fetch and never automatically refunded. Corrupt ledgers fail closed; a stale lock must be reviewed, not deleted blindly.

That initial recovery batch completed all 96 requests with 96 Mubit replies and 96 raw shape/route/protection checks passing, across 24 independent sessions. All 96 replies ended with `finish_reason: stop` and had actual middleware IDs and returned token counts. Usage was 120,928 prompt / 26,110 completion / 147,038 total tokens; median latency was 2,586.5 ms and p95 was 4,238 ms. The production model remained `gpt-6-luna` and the local prompt fingerprint remained `6a9d76c14edc86cf8cf94c005ed2c09c08ddb15564433f6d5f691ceb2c3dac21`. This is a broader set of recorded Mubit examples, not an adapter-quality result. Recovery budget now records 96/200 attempts used and round 1/3 completed; 104 attempts and at most two rounds remain, subject to useful feedback.

The console inspection after this batch still showed **Reviewing examples**, **40 kept / 1 rejected / 97 waiting review / 23 couldn't be reviewed**, and **31 sessions with kept examples**. Its Review today row displayed **72 queued / 0 over the limit / 3 running**; other call counters on the same page were inconsistent, so these labels are preserved without deriving a reconciled total. The only adapter version/job still shown was v1 / `ftjob_7b85f04e`. A new training submission had **not** been established. `console-after-batch.json` and `console-after-batch.txt` in the recovery runtime directory preserve this checkpoint for the follow-up. Wait for curation/job progress rather than treating the 96 successful requests as 96 kept examples or repeatedly resending them.

The runner stops on a provider/fallback error or raw decision mismatch. Later attempts require `--feedback <ignored-json-file>` containing a concrete `reason`, actual grading/console `evidence`, and targeted `caseIds`, including each selected session's earlier turns. A subsequent command may use `--count <bounded-number>` but cannot exceed the ledger's remaining allowance or the three-round limit. New input must address useful feedback; do not repeatedly resend the same batch, lower quality gates, switch opaque engine knobs or claim an unverified foundation change. Any separate paid recovery evaluation must use this same budget; do not bypass it with the ordinary evaluator. Console polling is read-only and should alert only on a meaningful state change, a submitted training run, a completed result or a blocker.

The fifteen-minute follow-up should first run the local status command, avoid a live batch while its worker lock exists, then inspect task `ln_f033afe97baac3c175b28c3f` and adapter `ad_lane_a96a2bdc` in the console. Record kept/rejected/queued counts, version and job IDs, actual base, grading reasons, judged-case count and routing. New kept examples are not themselves proof that a new training job was submitted. A passed adapter still needs explicit serving evidence before any after-training comparison is attributed to it.

## Metric definitions

| Metric | Meaning |
| --- | --- |
| Constraints | Valid bounded decision plus enforced villager protection in the final guarded response |
| Explicit route preference | Correct mystery/combat choice on the 12 declared preference cases |
| Preference micro-F1 | Micro-averaged true positives, false positives and false negatives across the combat/mystery booleans in those cases; villager protection is excluded |
| Committed route | Preserved route across the eight later-phase cases |
| Phase objective | Expected phase-specific objective in those eight cases |
| Latency | Measured end-to-end director median and p95; not a provider-only or training-speed claim |
| Token usage | Gateway-reported counts; unknown counts remain null in request records |

Constraint, committed-route and objective scores include deterministic backend guards. They do not demonstrate that the raw model output followed every rule. Dialogue factuality and NPC consistency still need human review. The evaluator itself does not play Minecraft, exercise a microphone or inspect generated geometry. Separate checks recorded the completed mystery UI playthrough, combat generation and death/respawn behavior, and a single-sentence voice smoke check; a completed combat rescue remains unverified. Runtime reports are ignored by Git and contain synthetic dialogue, not credentials.
