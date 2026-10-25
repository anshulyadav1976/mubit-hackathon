# Evidence handoff and editorial graphics

Root's actual export, expected at `work/film-data/session-evidence.json` relative to the repository, is the source. `session-evidence.template.json` is a **template**, not evidence. Adapt field names from the actual exporter without changing their meaning. Root/game agent owns export generation; this film package must not manufacture request or outcome records to populate missing footage.

## Provenance rules

- `origin`: `historical_session_export` or `fresh_capture_export`. A historical export may support a labelled prior-run card; it cannot populate a fresh capture's transcript, request, timing or game outcome.
- `capturedAt`, `sessionId`, `sourceFile`: identify the actual export/run. Do not infer a session from today's date or from a nearby source file.
- `metrics.scope`: identify a full recorded session, individual request or other explicit measurement boundary. Null means unavailable, not zero.
- Planned dataset counts are intentions. Prepared counts require inspected files. Submitted counts require provider requests. `kept` requires provider evidence, not local validation or HTTP success.
- `targetKept: 50` means a project target only. It is not a measured count or a claim about Mubit thresholds.
- `providerModel` is the requested model ID. It does not establish which foundation/adapter served a request. `servingModel` stays null without provider routing evidence.
- Never relabel a fallback response `mubit`. Never put a green trained badge beside v2 while training is pending.

## Per-turn record shape

`turns` remains empty until actual capture/request correlation exists. Each real entry may contain the following fields; missing fields stay null or are omitted, never filled with plausible examples:

| Field | Meaning / allowed use |
| --- | --- |
| `clipId` | Stable capture asset ID such as C07; refers to actual manifest entry. |
| `sessionId` | Actual session identity, consistent across linked selection/correction/commit shots. |
| `requestId` | Actual exported request ID; full value stays in evidence, visible short suffix must be unique. |
| `transcript` | Actual recognized player transcript; distinguish from an editorial caption of what was audibly said. |
| `source` | Actual `mubit`, `openrouter` or `local` source, using exporter vocabulary. |
| `providerModel` | Requested provider model ID. Label **Requested model**. |
| `servingModel` | Independently verified actual serving model/adapter, otherwise null. |
| `latencyMs` | Measured request duration with timing boundary identified. Never relabel it full voice latency. |
| `rawDecision` | Actual returned `chapter`, `route`, `mood`, `difficulty`, `intent`, `answer`, and other retained fields. Distinguish from any server-defaulted decision. |
| `localValidation` | Application validation result and reason. Use `passed`/`failed`/`unknown`; never title this **Mubit accepted** or **kept**. |
| `gameOutcome` | Actual server event, authoritative quest stage and required evidence. Null if not exported. A predicted intent is not an outcome. |
| `eventOffsetsMs` | Verified positions relative to the raw source clip: speech submission, response receipt, validation, game event. Null if unavailable; do not estimate for a claimed synchronized trace. |
| `sourceFile` | Sanitized provenance source, with no secrets or unrelated private dialogue. |

If only a server-defaulted decision is available, label it **Validated application decision**, not **Raw model output**. If the seal opens visibly but there is no event export, show the real opening and say **Visible gameplay outcome**; do not invent a corresponding server record.

## G01 fallback variants

Preferred: fresh C07 turn with real source/model/request, synchronized to the proof footage. Only the matching source can assert **Mubit in the loop** for that turn.

If no fresh trace exists but the sanitized historical metrics are available, use the following exact card instead:

**PRIOR COMPLETED SESSION**

`Mubit responses  {mubitResponses}`

`Local text fallbacks  {localFallbackResponses}`

`Provider errors  {providerErrors}`

Footer: **Historical integration observation • not an adapter evaluation**.

Show actual exported numbers, not values copied from this specification. Do not imply the prior session is the visible fresh playthrough. No quality percentages, cost savings or adapter inference claim may be derived from these counts. If both fresh and historical data are missing, replace the card with the architecture sequence and omit quantitative claims.

## G03 dataset copy binding

Before artifact validation: **Offline corpus: 240 turns / 60 sessions planned**; **Holdout: 60 cases / 15 sessions planned**.

After root verifies those exact artifacts: **Offline corpus: 240 turns / 60 sessions prepared**; **Holdout: 60 cases / 15 sessions separate**.

Both versions: **Submitted: 100 · kept: unknown · target: 50** while that is the actual current state. Do not animate a progress bar from 0 to 50: it would imply progress that has not happened.

Footer: **V2 not trained • no demonstrated small-model savings**.

If data arrive with different counts, show those counts and provenance, not these expected values. An updated serving result requires a new explicit evidence review; it does not follow from a prepared dataset.

## Editorial graphic construction

Use real data as text on a clearly editorial panel. No counterfeit console chrome, browser URL bar, console screenshots, fake provider logo badges or imaginary graphs. Story copy is serif; evidence is monospace. A teal rule denotes a fact panel, not a pass verdict. `title.svg` and `evidence-frame.svg` are editable static art; no figures are embedded in the frame. Root supplies actual dynamic labels in the composition.

Redact credentials, authorization headers, local capability tokens, account identifiers not needed for proof, filesystem home paths, and unrelated conversation. Keep a private original only within the existing permitted evidence storage. A short request suffix preserves useful correlation without presenting the entire trace payload on screen.
