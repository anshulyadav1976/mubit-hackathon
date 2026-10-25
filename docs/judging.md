# EVERAFTER: the demo argument

**Tell the characters what kind of adventure you want. EVERAFTER turns that conversation into a branch of its story graph and builds the chosen chapter physically in Minecraft.** The graph connects clues, trials, guardian choices and a rescue to a factual ending. Minecraft is the playable demonstration; the reusable product is a narrative director for RPG developers.

The [submission report](submission-evidence.md) separates observed results, project targets and potential benefits. The [quest graph](quest-graph.md) shows the implemented branches and server-owned rules. No official judge scores have been recorded in this repository.

The concrete recurring task is: given a character, authoritative quest facts, recent conversation and player preferences, produce one consistent reply and a safe next-chapter decision. Players can correct the director before committing a chapter. The next area, challenge and atmosphere reflect that decision; the rescue changes the village.

## Track evidence

The [official event brief](https://luma.com/nightshift-london) lists three tracks and judges the top prizes across them. The mapping below distinguishes implemented behavior from evidence still required.

| Track | Product demonstration | Evidence needed before claiming completion |
| --- | --- | --- |
| Recurring tasks | Every NPC turn uses the same director contract. A player corrects a preference and receives an updated proposal. | A recorded correction, a kept example, and a subsequent adapter version in the Mubit console. Session memory alone is insufficient. |
| Own your intelligence layer | Stable gateway workload with bounded structured output and a reproducible evaluation runner. | Passing task-adapted open-model inference, compared with the original provider on the same fixtures. Record quality, latency and actual cost where available. |
| Fast refresh | Changed player preferences immediately affect the uncommitted chapter through application context. | Separate provider evidence that new examples produced a later model version. Immediate context changes are not weight updates. |

## Four equally weighted criteria

| Criterion | What to show |
| --- | --- |
| Use of Mubit | Trace a real correction through a recorded request to an adapter update, then identify the model serving a later request. This remains the critical submission dependency. |
| Usefulness | Let a player ask for puzzles instead of combat and receive a playable puzzle chapter. The prospective customer is an RPG team repeatedly authoring personalized encounters; customer demand and retention gains are hypotheses, not measured results. |
| Technical execution | Demonstrate a complete rescue, validated scene choices, protected quest facts, bounded world construction, failure recovery and local voice input. Explain the four authored realms, trial composition, and evidence-gated encounters honestly. |
| Demo | Speak, correct a preference, reveal the chapter, complete an objective, and return to a changed village. Keep the console evidence ready beside the game. The public page does not specify the exact presentation duration; use the organizer's confirmed limit. |

## Suggested short presentation

“Mara gives me four clues to her missing sister. I answer in my own words. EVERAFTER turns my preferences into a chapter choice, builds its realm in Minecraft, and carries my decisions through a branching story graph to the reunion.”

Speak one preference. Show the resulting structured decision. Correct it before crossing, then choose the intended route. Enter the chapter and solve one visible objective. Use the completed rescue only after actually earning it; no presentation shortcut should masquerade as gameplay.

Once real training is verified: show the correction request and the resulting Mubit adapter version, then the matched evaluation. Quote observed numbers, including failures. Close with the product opportunity: developers retain a small, testable director for their game's recurring decisions.

## Demo scope and expansion vision

- **Playable now:** a preference-directed rescue graph, four authored realms, three trials, physical world construction and evidence-gated guardian outcomes.
- **Recorded Mubit results:** 100 valid story-v2 candidate responses, with 89 matching every authored field check; one completed Ember session with 13 Mubit responses and zero local story fallbacks or provider errors. These describe candidate checks and one integration session.
- **Adapter status:** training preparation and candidate submission are recorded. A passing story-v2 adapter, verified serving and a matched quality, cost or latency improvement remain to be established. Immediate preference changes use application context.
- **Expansion vision:** a growing graph of linked chapters and world modules for open-ended campaigns. The current demo provides 36 categorical chapter configurations and one adventure per server run.

See [demo controls](demo.md), [architecture](architecture.md), and [evaluation protocol](evaluation.md).
