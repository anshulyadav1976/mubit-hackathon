# Story v2 validation — 24 October 2026

## Automated checks

| Suite | Passing tests |
| --- | ---: |
| Node director, story, voice, HTTP and legacy-runner guards | 47 |
| Paper parsing, interactions, quest stages and world geometry | 28 |
| Fabric voice format, input edges and conversation state | 14 |
| Service lifecycle | 15 |
| Prism installer | 3 |

The three geometry test methods exercise 24 realm/trial/mood combinations, including connected reading aprons, gate partitions, stage openings and the final escort road. These are offline checks, not 24 native playthroughs.

## Native Minecraft evidence

A shared user/agent playthrough completed Ember Keep’s riddle/combat branch on this Mac. A real clue click and the answer to the fire riddle produced the witness relic and opened the trial seal. Sentinel and Warden were real combatants with changing health; marked attacks and Warden reinforcement echoes appeared. The user finished both bosses. The agent confirmed server facts for the opened refuge, Elin’s rescue, and the completed village reunion; the book and star rewards appeared in the hotbar.

Right-click voice was tested without a Screen: recording began before the test phrase was played through the speakers, the second click submitted the local transcript, and Mubit returned a validated story-v2 reply in 5,022 ms. Separately, the microphone recorded Mara’s actual in-game greeting: local transcription recovered the distinctive compass, drowned-page, guardians and oath content. This verifies audible game output as well as local input; it does not establish word-perfect recognition in venue noise.

The completed campaign recorded 13 actual Mubit responses, 0 local text fallback responses and 0 provider errors. This is an integration observation, not a held-out quality score, cost comparison or adapter evaluation. Speaker/microphone test recordings and private conversation history are not committed.

Native testing found and fixed stale Bukkit actor wrappers after chunk reload, unpinned village chunks, portal arrival cooldowns, oversized bubbles, distant action feedback, rescue speech being cancelled by a new recording, and Villager AI wandering during conversations. Final checks use the rebuilt jars.

## Limits

Only the Ember campaign was completed natively, with user assistance for combat. The other realms’ geometry and the peaceful boss branches have automated coverage; a complete native playthrough of each was not performed. The legacy Mubit adapter does not validate this new prompt/schema. Training convergence, deployed adapter routing, and any benefit over the original model remain unverified. Realms are authored assemblies with bounded story choices.

## Expressive voice follow-up

The user requested hosted voices in place of the local macOS sound. Six short synthesis checks returned actual OpenRouter audio from `google/gemini-3.8-flash-tts`, one for each character: Kore/Mara, Charon/Oren, Leda/Elin, Fenrir/Ivo, Orus/Sentinel and Algenib/Warden. Character-specific emotional delivery is sent separately in `instructions`, keeping it out of the spoken transcript. These requests took 2.4–4.2 seconds each. This establishes successful hosted generation for every selected voice; perceived acting quality remains subjective. Existing request-budget and local-fallback safeguards remain.
