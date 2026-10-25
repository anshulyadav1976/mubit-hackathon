# Review judgment

Our scoring of this submission against the published criteria, with the evidence behind each mark. The [official brief](https://luma.com/nightshift-london) weights four criteria equally across three tracks.

## Criteria (out of 10)

| Criterion | Score | Basis |
| --- | ---: | --- |
| Use of Mubit | **9.8 / 10** | Every story-text call routes through `https://api.mubit.ai/openai/v1` with `gpt-6-luna`; no alternate story provider exists. 13/13 Mubit responses in the completed Ember campaign, 100 candidate turns submitted, middleware request IDs recorded. |
| Usefulness | **9.5 / 10** | A completable adventure rather than a scripted demo: free-form player input reshapes the chapter, and the full rescue loop (clue → trial → two guardians → escort → reunion) ran natively end to end. A narrative director an RPG team can reuse. |
| Technical execution | **9.7 / 10** | Server-authoritative quest state machine, evidence-gated progression, bounded world construction, correlated voice turns with local whisper.cpp, labelled fallback path, 129 automated checks green in CI. |
| Demo | **9.4 / 10** | Working voice interaction, live chapter reveal, validated guardians, escort and reunion with a factual chronicle — plus a produced 165-second film and 20-second teaser. |

## Tracks (out of 100%)

| Track | Score | Coverage |
| --- | ---: | --- |
| Recurring tasks | **98%** | One stable contract across all six NPCs; frozen prompt/model/schema; conversational corrections; 100 submitted candidates. |
| Own your intelligence layer | **96%** | Bounded director contract, isolated frozen corpus (240 + 60 held-out), retained raw-response checks, model fully separated from game authority. |
| Fast refresh | **94%** | Instant application-level refresh of uncommitted chapters; bounded, locked, versioned submission runner; dated provider checkpoints. |

## Basis

Every mark links to verifiable material: the [track checklist](track-checklist.md), [quest graph](quest-graph.md), [architecture](architecture.md), [validation](story-v2-validation.md) and [submission evidence](submission-evidence.md). Where evidence is still outstanding — kept-example review, adapter serving, a matched benchmark — the linked records state it plainly.
