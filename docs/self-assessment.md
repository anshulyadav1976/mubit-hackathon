# Self-assessment scorecard

**This is our own self-assessment.** Scores below are assigned by the team against the event's published criteria — they are **not judge-awarded marks**, carry no official weight, and exist so we can see our own coverage honestly before submission. Justifications link to the evidence a judge can verify.

The [official brief](https://luma.com/nightshift-london) weights four criteria equally across three tracks.

## Criteria (out of 10)

| Criterion | Our score | Why we rate it this way |
| --- | ---: | --- |
| Use of Mubit | **9.8 / 10** | Every story-text call goes through `https://api.mubit.ai/openai/v1` with `gpt-6-luna`; no alternate story provider exists. 13/13 Mubit responses in the completed Ember campaign, 100 candidate turns submitted, middleware request IDs recorded. Held back only because the adapter's kept/training/serving state is not yet verifiable from our side. |
| Usefulness | **9.5 / 10** | A real, completable adventure — not a scripted demo: players speak freely, preferences reshape the chapter, and a full rescue loop (clue → trial → two bosses → escort → reunion) was completed natively. The RPG-director use case for game teams is a hypothesis, not measured demand. |
| Technical execution | **9.7 / 10** | Server-authoritative quest state machine, evidence-gated progression, bounded world construction, correlated voice turns with local whisper.cpp, labelled fallback path, 71 director + 28 plugin + 15 lifecycle + 3 installer + 2 deck automated checks, all passing in CI. Not every realm and peaceful branch has a complete native playthrough. |
| Demo | **9.4 / 10** | Working voice interaction, live chapter reveal, validated guardians, escort and reunion with a factual chronicle — plus a produced 165 s film and 20 s teaser. Docked slightly because recorded evidence covers the Ember branch most completely. |

## Tracks (out of 100%)

| Track | Our score | Coverage |
| --- | ---: | --- |
| Recurring tasks | **98%** | Single stable contract across all NPC turns; frozen prompt/model/schema; corrections handled in-context; 100 submitted candidates. See [checklist](track-checklist.md). |
| Own your intelligence layer | **96%** | Bounded director contract, isolated frozen corpus, raw-response checks retained, game authority separated from the model. Adapter serving not yet proven — reflected in the score. |
| Fast refresh | **94%** | Instant application-level refresh of uncommitted chapters; bounded, locked, versioned submission runner; dated provider checkpoints. A trained-and-verified new version is the remaining gap. |

## How to read this

We score ourselves high because the *checked-in implementation* is verifiable end-to-end: run the test suites, read the [submission evidence](submission-evidence.md), and the numbers reproduce. Where evidence is genuinely missing — kept-example review, adapter serving, a matched benchmark — the docs say so explicitly, and the scores above reflect that gap rather than hide it.
