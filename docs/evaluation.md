# Reproducible evaluation and training evidence

The evaluator contains 20 authored synthetic cases: 12 explicit preference/correction cases and eight committed-route or quest-phase cases. They are separate from the 40 synthetic training utterances. Each evaluation case uses a distinct Mubit session; correction cases seed a labelled synthetic prior preference and conversation without making extra requests. These are test fixtures, not real player observations.

## Offline checks

```sh
node --test director/test/*.test.mjs
node director/evaluate.mjs
```

The default evaluator deliberately supplies an empty API key even if your environment has a key. It makes zero gateway requests and writes an `offline-fallback-validation` report under ignored `director/runtime/evaluations/`. It tests local fallback behavior, schema bounds, quest objectives, route locks and correction handling. Offline scores say nothing about Mubit training or model quality. Failed expectations are reported as failures rather than removed.

## Recorded offline measurements

The preserved `director/runtime/evaluations/offline-validation.json` report contains 20 authored synthetic cases, completed with **zero Mubit requests** and 20 local fallback responses. It records 20/20 bounded-constraint checks, 11/12 explicit route preferences, preference micro-F1 0.9167, 8/8 committed-route checks, and 8/8 phase-objective checks. Its `correct-action` miss was “Forget my old puzzle preference. I want combat now.”: the fallback let the earlier puzzle mention override the later correction.

After changing the shared fallback/provisional parser to apply preference clauses in order, a separate `director/runtime/evaluations/offline-correction-fix.json` run of the same 20 fixtures records 20/20 bounded constraints, 12/12 explicit route preferences, preference micro-F1 1.0000, 8/8 committed routes and 8/8 phase objectives. It also made **zero Mubit requests**. Regression tests cover that exact correction, the inverse, final negations, preserved history and successful Mubit decisions remaining authoritative. The prior failure report was not overwritten. These measurements demonstrate a deterministic parser fix on these synthetic cases; they are not trained-model metrics or evidence of adapter improvement.

The local voice path also has a speaker-to-microphone smoke check: one spoken sentence was recognized exactly by whisper.cpp tiny.en. That single observation is not a speech-recognition benchmark, and the director evaluator does not exercise audio.

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

Constraint, committed-route and objective scores include deterministic backend guards. They do not demonstrate that the raw model output followed every rule. Dialogue factuality and NPC consistency still need human review, and the evaluator does not play Minecraft, exercise a microphone or inspect generated geometry. Runtime reports are ignored by Git and contain synthetic dialogue, not credentials.
