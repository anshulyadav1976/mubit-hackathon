# EVERAFTER: the demo argument

**A game director that learns what kind of adventure a player wants, then turns the conversation into playable consequences.** Minecraft is the test environment; the reusable product is the bounded narrative director for RPG developers.

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

“Mara gives me four clues to her missing sister. I answer in my own words. That shapes the realm, its trial, and how I can confront its guardians.”

Speak one preference. Show the resulting structured decision. Correct it before crossing, then choose the intended route. Enter the chapter and solve one visible objective. Use the completed rescue only after actually earning it; no presentation shortcut should masquerade as gameplay.

Once real training is verified: show the correction request and the resulting Mubit adapter version, then the matched evaluation. Quote observed numbers, including failures. Close with the product opportunity: developers retain a small, testable director for their game's recurring decisions.

## Do not claim

- Endless generated worlds: geometry is assembled from four authored realms with bounded encounter choices.
- Instant training: preference memory changes immediately; provider training is asynchronous.
- Improved quality, lower cost, or faster inference without the corresponding measured comparison.
- A guaranteed prize or full score. A polished game does not replace the required Mubit evidence.

See [demo controls](demo.md), [architecture](architecture.md), and [evaluation protocol](evaluation.md).
