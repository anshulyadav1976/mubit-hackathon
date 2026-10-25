# EVERAFTER: implementation, results and potential

EVERAFTER is a voice-driven Minecraft rescue RPG and a reusable experiment in conversational game direction. Players question characters, revise an uncommitted lead, face a clue-based trial and two guardians, and bring a missing sister home. The engineering contribution is a stable narrative task connected to a server-authoritative quest graph: generated language can change the experience without inventing completed game actions.

This report separates implemented behavior, observed measurements, targets and proposed extensions. It contains no official judging verdict or awarded score.

## What Mubit does in this build

| Part | Current implementation |
|---|---|
| Recurring story decision | The Node director sends the same structured narrative contract through Mubit with changing NPC, player preferences and observed quest facts. |
| Requested model | `gpt-6-luna` through `https://api.mubit.ai/openai/v1`. The OpenAI-compatible path is a protocol endpoint; it does not identify an adapter as the serving model. |
| Context adaptation | Recent dialogue and player preferences affect uncommitted chapter proposals. Once a chapter is committed, facts and configuration are preserved. |
| Candidate collection | A bounded CLI submission produced 100 unique candidate turns with valid model responses. Mubit controls curation and subsequent training. |
| Adapter deployment | No passing or serving story-v2 adapter was established at the recorded checkpoint. A requested model or gateway source label is not serving evidence. |
| Speech recognition | Local whisper.cpp/tiny.en. Raw microphone audio stays local. |
| Hosted speech | OpenRouter Gemini TTS with separate character voices and delivery instructions; macOS synthesis is the fallback. Speech is distinct from the Mubit story decision. |

The source is [director.mjs](../director/director.mjs), [prompt.mjs](../director/prompt.mjs), [speech.mjs](../director/speech.mjs) and [voice.mjs](../director/voice.mjs). The [architecture](architecture.md) describes client/server trust boundaries and the [quest graph](quest-graph.md) maps the playable decisions.

## Observed evidence

| Observation | Recorded result | Interpretation |
|---|---|---|
| Story-v2 candidate batch | 100 unique turns, 25 conversations, 101 gateway attempts; 100 valid story JSON responses | One reasoning-only truncated response was recovered with a larger completion allowance. No held-out cases were submitted. |
| Candidate field checks | 89/100 valid responses matched every authored field check; 11 differences retained | Checks on selected synthetic candidates, not a held-out adapter benchmark. |
| Director checks before continuation | 68 tests passed | Local automated checks of behavior, request contracts, guards and bounded submission; not a 68-player trial. |
| Completed Ember campaign | 13 Mubit responses, 0 local story fallbacks, 0 provider errors | One recorded integration session, with user assistance for combat; not a universal reliability score. |
| Native voice turn | Validated story-v2 reply recorded at 5,022 ms | One voice-flow integration observation, not a latency distribution or adapter-speed claim. |
| Hosted character speech | Six successful synthesis checks; 2.4–4.2 seconds each | Audio generation for the six voices; no objective acting-quality score. |
| Story-v2 console, 25 October 00:40 BST | 153 usable calls, 0 kept, 0 rejected, 153 awaiting review; 19 reviews running; first training not started; no routes | A task-wide, dated console snapshot. It includes calls outside the candidate batch and does not establish why reviews were unfinished. |
| Legacy Qwen3-4B adapter v1 | `Prompt only`, 0% across 12 scored cases, no linked serving path | Historical result for the previous prompt; it is not a successful deployment for the current game. |

See [submission provenance](story-v2-submission.md), [native and automated validation](story-v2-validation.md), and [evaluation history](evaluation.md). The frozen corpus has 240 candidate turns and 60 separate held-out turns; its preparation-time `submitted: 0` is historical. All synthetic, integration and provider-evaluation results retain their distinct scopes.

## Before/after comparison and targets

There is no matched story-v2 provider-versus-adapter benchmark yet. The older provider baseline and current candidate batch have different contracts or fixtures, so a numerical improvement between them would be invalid.

| Measure | Current evidence | Adapter result | Target or proposed benefit |
|---|---|---|---|
| Held-out decision quality | 60 authored held-out turns prepared; not submitted or scored in a live story-v2 evaluation | Not measured | Engineering target: at least 95% correct structured decisions on a frozen, independently scored set. This is not a judge-awarded mark. |
| Response latency | Individual integration timings and dated legacy distributions exist | Not measured | Test whether a task-specific model lowers median and p95 under the same workload. |
| Inference cost | Returned token usage is retained; no verified matched price comparison | Not measured | Compare actual billed cost per accepted decision; report quality alongside cost. |
| Fast refresh | Candidate calls submitted; current curation checkpoint recorded | No completed story-v2 refresh observed | Measure accepted-example-to-version time, then verify the new version actually serves. |

Once a version passes, preserve the frozen evaluation inputs, verify provider and adapter serving identities, use the same input set, and report errors, raw and guarded quality, latency distributions and actual cost. Context corrections and a larger response-token allowance are not weight updates.

## Event tracks and criteria

The [official brief](https://luma.com/nightshift-london) names three tracks and four equally weighted criteria. The table maps current evidence and remaining work; it does not assign official marks.

| Track | Current product evidence | Next proof |
|---|---|---|
| Recurring tasks | Repeated NPC-turn contract, contextual corrections, stable task fingerprint and submitted candidate calls | Retained correction examples producing a new adapter version. |
| Own your intelligence layer | Structured director contract, isolated synthetic corpus, raw-response checks and controlled game execution | Passing task-adapted open-model inference with a matched quality/cost/latency comparison. |
| Fast refresh | Player context changes proposals before commitment; the submission runner preserves versioned evidence | A measured later model update and verified serving after fresh examples. |

| Criterion | Strongest existing evidence | Remaining limitation |
|---|---|---|
| Use of Mubit | Actual story calls and request IDs, candidate submissions and a dated console checkpoint | A correction-to-trained-version-to-served-request chain is not yet established. |
| Usefulness | A recurring NPC direction task connected to playable consequences | RPG-team demand, authoring-time reduction and player retention are customer hypotheses. |
| Technical execution | Server-owned graph guards, evidence-tagged inventory, real encounters, correlated voice, bounded world building and failure handling | Not every realm and peaceful branch has a completed native playthrough. |
| Demo | Working voice interaction, chapter choice, playable rescue and ending | Demo evidence must preserve actual provider, fallback and recording provenance. |

## Product potential: proposed, not measured

The prospective customer is a game team that repeatedly needs consistent NPC replies, chapter routing and encounter guidance. A compact model trained on that stable contract could become a reusable intelligence layer while the game engine retains authority over rules. Reduced authoring work, lower inference costs and better player engagement are hypotheses to test, not reported outcomes.

Current variety comes from four authored realms, three trials, three twists, approach, atmosphere, difficulty, generated dialogue and guardian outcomes. **36 categorical chapter configurations are implemented; infinite generated worlds are not.** An expandable chapter graph, additional world modules and longer campaigns are plausible extensions. They need implementation, persistence, reachability checks and new native validation before becoming product claims.

For voice routing, Mubit's [OpenAI-compatible service guide](https://docs.mubit.ai/guides/openai-compatible) documents chat completions, embeddings and model listings; other compatibility paths return 404. The current speech code uses `/audio/speech`, so changing only its hostname is not a supported migration. A genuine Mubit audio integration needs a supported audio route, suitable provider access and a recorded audio check. It would still need accurate upstream model attribution. The event's all-LLM-calls routing requirement should not be represented as proven for the current direct hosted speech path.

## Informal feedback notes

The project creator reported the following conversations during the hackathon on 25 October 2026: the CTO described the idea as fun and cool; the CEO enjoyed the demonstrated game/video and trailer; feedback was positive about the choice graph, constraints and use of Mubit. These are attributed recollections supplied by the creator, not independently witnessed quotations, official endorsements, judge scores or award decisions.

## Reproduce and inspect

Start with the README's local run instructions and [demo controls](demo.md). Inspect `Quest` and the action handlers in the [Paper plugin](../plugin/src/main/java/ai/everafter/EverafterPlugin.java), then [quest tests](../plugin/src/test/java/ai/everafter/QuestProgressTest.java), [geometry tests](../plugin/src/test/java/ai/everafter/WorldBuilderGeometryTest.java), [director tests](../director/test/director.test.mjs), and [submission tests](../director/test/story-v2-submission.test.mjs). No paid evaluation or training loop runs automatically on startup. Existing schedules were paused by the user.
