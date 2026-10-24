# Offline film evidence

This exporter reads local files only. It makes no network requests, submits no training data, and changes no game or Director state. Use private output storage; review any selected text before publishing it.

From the repository root:

```sh
node director/film-evidence.mjs \
  --state director/runtime/state.20261024-210153.1792872113362119000.json \
  --summary ../work/story-v2-live-evidence.json \
  --out ../work/film-data/session-evidence.json
```

The default export contains no conversation: `turns` is empty. It verifies the supplied summary against the archive, replaces the player/session identity with a fictional demo alias, and exports allowlisted final quest facts plus scoped historical session counters. The documented Ember run has 13 Mubit responses, zero local fallbacks and zero provider errors. Those are integration observations under story v2, not adapter quality or cost measurements.

Add `--request-id ID` once per deliberately selected demonstration turn, at most eight. Unknown and duplicate IDs fail. Selected telemetry retains local and provider request IDs, reported token counts, source, requested provider model, latency and safe error codes. Missing usage remains null. Historical OpenRouter source labels stay historical; current Director story text uses Mubit exclusively and labelled authored local fallback on failure.

Newly retained Director turns now attach the same local `requestId` to the user message, guarded assistant reply, `lastDecision` and request telemetry. After the updated backend is loaded, explicitly selecting that ID lets the exporter correlate both transcript and reply. The historical archive shown above predates this change and has no request IDs on its conversation entries, so those historical transcripts still return null. No historical IDs are backfilled. It never guesses by timestamp or array order. Exactly correlated selected text, if present, has known player names, UUIDs, emails and common secret/token forms removed. Unselected ambient history, inbox contents and arbitrary state fields are excluded. Redaction is not a substitute for reviewing selected dialogue before publication.

Raw model decisions, per-turn game outcomes and per-turn validation results were not retained and remain null. A matching `lastDecision` may be exported separately as `guardedDecision`; it has already passed backend guards and must not be called raw model output. `localValidation` is unrelated to Mubit example curation. The final quest snapshot has an explicit end-of-session scope and cannot establish which selected turn caused a game action.

Prepared-corpus counts remain null until independently loaded or documented. `submitted: 0` means this offline exporter submits nothing; it does not rewrite historical legacy-contract training. Mubit-kept examples, serving model, adapter improvement, verified prices, costs and savings are not inferred.
