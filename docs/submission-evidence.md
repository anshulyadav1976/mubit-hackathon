# EVERAFTER: graph-based storytelling in a playable Minecraft world

EVERAFTER turns natural conversation into a **graph-based Minecraft adventure**. Players tell characters what interests them; the Mubit-backed director interprets their preferences into a realm, trial, atmosphere, difficulty and twist. The server then constructs the chosen chapter as physical Minecraft geometry, with characters, clues, barriers and encounters.

The story graph gives those choices consequences: discover evidence, solve a trial, fight or spare the Sentinel and Warden when the prerequisites allow it, rescue Elin and escort her home. The ending records the player's actual decisions. A reusable narrative director connects generated dialogue to game rules that the server can validate.

## Creator-verified demo results

On **25 October 2026**, the project creator confirmed that their testing verified **effectively unlimited stories and worlds shaped by player preferences**, and **substantially improved results from the Mubit adapter**. These are creator-reported qualitative findings; no exhaustive world count or numerical before/after benchmark was supplied. The archived implementation details and measurements below retain their original scope.

This report separates creator verification, checked-in behavior, archived measurements, targets and proposed extensions. It contains no official judging verdict or awarded score.

## Graph-based story and on-demand world construction

The [playable quest graph](quest-graph.md) is the structure behind the adventure. Its nodes represent quest stages; its edges require real discoveries, trial outcomes, guardian decisions and an escort. The selected trial branches into a riddle, gauntlet or parley, while earlier mercy determines whether the final guardian can be spared.

Player preferences shape the chapter before construction. [`WorldBuilder.buildChapter`](../plugin/src/main/java/ai/everafter/WorldBuilder.java) then applies authored block geometry in server-tick batches; the [Paper plugin](../plugin/src/main/java/ai/everafter/EverafterPlugin.java) spawns NPCs and bosses and opens barriers as the player earns progress. The result is a playable space built during the run, with dialogue, story state and physical encounters connected through the same quest progression.

The demo implements four realms, three trials and three twists: **36 categorical chapter configurations**, plus variation in approach, atmosphere, difficulty, generated dialogue and three legal guardian-outcome pairs. These dimensions describe different aspects of the experience; they are not a measured count of unique worlds.

## Mubit: recurring decisions and adapter results

| Part | Checked-in implementation, archived evidence or creator result |
|---|---|
| Recurring story decision | The Node director sends the same structured narrative contract through Mubit with changing NPC, player preferences and observed quest facts. |
| Requested model | `gpt-6-luna` through `https://api.mubit.ai/openai/v1`. The OpenAI-compatible path is a protocol endpoint; it does not identify an adapter as the serving model. |
| Context adaptation | Recent dialogue and player preferences affect uncommitted chapter proposals. Once a chapter is committed, facts and configuration are preserved. |
| Candidate collection | A bounded CLI submission produced 100 unique candidate turns with valid model responses. Mubit controls curation and subsequent training. |
| Historical adapter checkpoint | No passing or serving story-v2 adapter was established at the 25 October, 00:40 BST console observation. This is the archived state before the creator's verification update. |
| Creator-verified adapter result, 25 October | The creator reports that using the Mubit adapter substantially improved the demo. This is a qualitative result; a matched numerical benchmark has not been added to the repository. |
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

## Adapter evaluation and next measurements

The creator has verified a qualitative improvement from the Mubit adapter. A matched story-v2 provider-versus-adapter numerical benchmark has not been supplied for this update. The older provider baseline and candidate batch have different contracts or fixtures, so they cannot supply a numerical before/after gain for the reported result.

| Measure | Archived quantitative evidence | Numerical adapter result | Target or proposed benefit |
|---|---|---|---|
| Held-out decision quality | 60 authored held-out turns prepared; not submitted or scored in a live story-v2 evaluation | Not measured | Engineering target: at least 95% correct structured decisions on a frozen, independently scored set. This is not a judge-awarded mark. |
| Response latency | Individual integration timings and dated legacy distributions exist | Not measured | Test whether a task-specific model lowers median and p95 under the same workload. |
| Inference cost | Returned token usage is retained; no verified matched price comparison | Not measured | Compare actual billed cost per accepted decision; report quality alongside cost. |
| Fast refresh | Candidate calls submitted; current curation checkpoint recorded | No completed story-v2 refresh observed | Measure accepted-example-to-version time, then verify the new version actually serves. |

To quantify the creator-verified improvement, preserve the frozen evaluation inputs, record provider and adapter serving identities, use the same input set, and report errors, raw and guarded quality, latency distributions and actual cost. Context corrections and a larger response-token allowance are not weight updates.

## Event tracks and criteria

The [official brief](https://luma.com/nightshift-london) names three tracks and four equally weighted criteria. The table maps current evidence and remaining work; it does not assign official marks.

| Track | Current product evidence | Next proof |
|---|---|---|
| Recurring tasks | Repeated NPC-turn contract, contextual corrections, stable task fingerprint and submitted candidate calls | Retained correction examples producing a new adapter version. |
| Own your intelligence layer | Structured director contract, isolated synthetic corpus, raw-response checks and controlled game execution | Passing task-adapted open-model inference with a matched quality/cost/latency comparison. |
| Fast refresh | Player context changes proposals before commitment; the submission runner preserves versioned evidence | A measured later model update and verified serving after fresh examples. |

| Criterion | Strongest existing evidence | Remaining limitation |
|---|---|---|
| Use of Mubit | Actual story calls and request IDs, candidate submissions, a dated console checkpoint and creator-verified adapter improvement | The request-to-version-to-serving evidence for the creator's result has not been archived here. |
| Usefulness | A recurring NPC direction task connected to playable consequences | RPG-team demand, authoring-time reduction and player retention are customer hypotheses. |
| Technical execution | Server-owned graph guards, evidence-tagged inventory, real encounters, correlated voice, bounded world building and failure handling | Not every realm and peaceful branch has a completed native playthrough. |
| Demo | Working voice interaction, chapter choice, playable rescue and ending | Demo evidence must preserve actual provider, fallback and recording provenance. |

## Product potential: proposed, not measured

The prospective customer is a game team that repeatedly needs consistent NPC replies, chapter routing and encounter guidance. A compact model trained on that stable contract could become a reusable intelligence layer while the game engine retains authority over rules. Reduced authoring work, lower inference costs and better player engagement are hypotheses to test, not reported outcomes.

The creator reports verifying **effectively unlimited stories and worlds** through the preference-driven graph experience. The checked-in implementation documents the core conversation → chapter decision → physical construction → validated consequence loop with 36 categorical chapter configurations and one adventure per server run. The broader product vision is an **open-ended campaign composer** with linked chapters, growing world modules and remembered consequences. Persistent multi-chapter campaigns require linked-chapter composition, more world modules, persistence, reachability checks and native validation.

For voice routing, Mubit's [OpenAI-compatible service guide](https://docs.mubit.ai/guides/openai-compatible) documents chat completions, embeddings and model listings; other compatibility paths return 404. The current speech code uses `/audio/speech`, so changing only its hostname is not a supported migration. A genuine Mubit audio integration needs a supported audio route, suitable provider access and a recorded audio check. It would still need accurate upstream model attribution. The event's all-LLM-calls routing requirement should not be represented as proven for the current direct hosted speech path.

## Informal feedback notes

The project creator reported the following conversations during the hackathon on 25 October 2026: the CTO described the idea as fun and cool; the CEO enjoyed the demonstrated game/video and trailer; feedback was positive about the choice graph, constraints and use of Mubit. These are attributed recollections supplied by the creator, not independently witnessed quotations, official endorsements, judge scores or award decisions. See the full [demo feedback notes](demo-feedback.md).

## Reproduce and inspect

Start with the README's local run instructions and [demo controls](demo.md). Inspect `Quest` and the action handlers in the [Paper plugin](../plugin/src/main/java/ai/everafter/EverafterPlugin.java), then [quest tests](../plugin/src/test/java/ai/everafter/QuestProgressTest.java), [geometry tests](../plugin/src/test/java/ai/everafter/WorldBuilderGeometryTest.java), [director tests](../director/test/director.test.mjs), and [submission tests](../director/test/story-v2-submission.test.mjs). No paid evaluation or training loop runs automatically on startup. Existing schedules were paused by the user.
