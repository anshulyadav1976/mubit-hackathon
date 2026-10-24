# Editable EVERAFTER composition

Run `node build.mjs` to regenerate 19 editable scene files and `index.html` from the approved `../timeline.csv`. It reads the sanitized **workspace** `work/film-data/session-evidence.json`. There is no browser fetch of private data: only explicitly selected fields become literal scene text. Full sessions, tokens and raw account metadata are not copied into the composition.

`node build.mjs --final` is the strict gate. It rejects missing/unverified footage, insufficient source durations, mismatched selection/correction sessions, an unverified continuous proof take, missing correlated proof data and unlicensed music. It probes clips with local `ffprobe` (`FFPROBE` can specify the binary). `npm run render` runs this gate first. The project renders locally and does not call a model provider. Actual captures and their provenance are supplied separately.

`npm test` checks timing, evidence semantics, missing-asset rejection and local asset paths. Runtime/layout validation is separate: `npm run check`. CLI pinned to 0.8.193, local GSAP pinned to 3.14.2. On a fresh clone, run `npm install` once in this directory to install the exact pinned development dependencies; then use `npm run check` and `npm run render`. No dependency installation occurs during a render.

## Capture manifest

Copy `capture-manifest.example.json` to `capture-manifest.json`, then replace paths/offsets and verify each imported clip. Do not overwrite an existing manifest. All paths are relative to this composition, under `assets/`. Clips are displayed with `object-fit: contain` at their recorded speed. C07 retains the uncropped source framing. C10C is an explicitly pre-cropped, recorded book insert; its source crop is documented in the private capture sidecar.

```json
{
  "clips": {
    "C07": {
      "path": "assets/footage/C07.mp4",
      "sourceStartSeconds": 0,
      "verified": true,
      "continuous": true,
      "audio": true,
      "sessionId": "ACTUAL_SESSION_ID",
      "requestId": "ACTUAL_REQUEST_ID",
      "captions": [{"start": 2, "duration": 3, "text": "ACTUAL RECORDED WORDS", "verified": true}]
    }
  },
  "music": {
    "path": "assets/audio/music.wav",
    "sourceStartSeconds": 0,
    "volume": 0.12,
    "licenseVerified": true
  }
}
```

The example above explains the format; its text/IDs must never be treated as captured evidence. `sourceStartSeconds` trims the source. Caption times are local to the edited clip. Proof `eventOffsetsMs.responseReceived` is relative to the imported footage file; the build subtracts any additional `sourceStartSeconds` trim in that file. Original raw-recording offsets remain in the provenance sidecar. The strict gate requires C07's capture session/request to match an exported turn. The export may use `rawDecision`, `guardedDecision` or `decision`. The current capture provides guarded data, displayed as **Validated scene decision**; it is not represented as an unmodified provider response.

Each required footage ID has its own manifest entry, even when several use separate ranges of one source recording. C03–C05 must share a session. C07 must be one unmodified 32-second interval at speed 1×. Do not mark a concatenated montage continuous.

Draft builds display missing footage as **DRAFT · FOOTAGE MISSING**. Final checks reject it. No synthetic gameplay is supplied. Historical session counts remain labelled as historical throughout. If the evidence export has no prepared counts, the film says they are unverified; it does not substitute the planned dataset quantities.

## Registry and local assets

Inspected official `lt-accent-underline` and `logo-sting` source before implementation; copies are retained as `references/*.source.txt`. The lower-third adapts the underline/name-rise pattern with a serif, dark text backing, and seek-safe `fromTo`. The logo-sting's flash and ring are omitted to match the approved restrained treatment. These are editorial graphics, not product UI.

Fonts are local copies from HyperFrames 0.8.193's bundled code-editorial preset: EB Garamond, Inter, JetBrains Mono. GSAP 3.14.2 was copied from the exact CDN URL already used by the scaffold. Nothing loads from a CDN at film runtime.

## Music credit

'Uprising' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au

Primary source: https://www.scottbuckley.com.au/library/uprising/

Root verified this license and supplies `assets/audio/music.wav`. Credit is preserved here and must accompany the delivered film (or appear in its end credits). The final mix uses music at gain 0.12 and recorded voice at gain 0.75. The selected music excerpt has volume changes and fades. Export QA verifies both source tracks survive the mix; subjective listening remains a separate review. No music rights are inferred for any replacement track.

## Rendering limitations

The source is fully editable; rebuilding replaces generated scene HTML. Preserve manual changes before rebuilding. Source-capture integrity, transcript accuracy and audio mix require human/video inspection in addition to the automated checks. Placeholder drafts are review materials, never submission-ready films.
