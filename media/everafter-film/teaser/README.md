# EVERAFTER — 20-second teaser

Five editable HyperFrames cuts, 1920×1080, 30 fps, exactly 600 frames:

| Time | Main-film source | Role |
| --- | --- | --- |
| 0–3 | C01 | Refuge/realm atmosphere; Bring her home. |
| 3–8 | C03 | A complete genuine spoken choice, with actual game audio. |
| 8–12 | C05 | The selected realm reveal. |
| 12–17 | C10B | Actual reunion. |
| 17–20 | Title | EVERAFTER — Bring her home. Your way. |

The gameplay excerpts are explicitly labelled **Edited gameplay sequence**. There is no claim of a continuous take, adapter improvement or model savings. No fabricated gameplay, character dialogue or captions are supplied.

`node build.mjs` reads `../composition/capture-manifest.json`. Optional `selection.json` overrides source offsets for the four clips without discarding their capture provenance. Start with `selection.example.json`. Set `C03.voiceVerified:true` only after listening to the actual five-second excerpt and confirming it includes one complete genuine spoken choice without replacing words. All excerpts remain at speed 1× and `object-fit: contain`.

The build hard-links existing main-film media/fonts/GSAP into the teaser's local `assets/`, so the renderer sees local assets without duplicating large footage files. Treat media as immutable; replace a source file rather than editing its bytes in place. A rebuild refreshes links when the source file was replaced. Everything lives on the same workspace filesystem; a hard-link failure is reported instead of silently copying huge files.

`node build.mjs --final` rejects missing or unverified footage, invalid/short intervals, an unverified spoken excerpt or missing/unlicensed music. `npm run render` runs that gate first. `npm test` checks timing, paths, selection merging and missing footage. On a fresh clone, run `npm install` once in this directory for the exact pinned dependencies. `npm run check` and `npm run render` then use local HyperFrames 0.8.193. No dependency installation or provider call occurs during a render.

## Music and asset credits

'Uprising' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au

License/source verified by root: https://www.scottbuckley.com.au/library/uprising/

A concise credit is visible on the title card; include this full attribution with the delivered video. The default music uses the start of main-film `assets/audio/music.wav` at gain 0.12. The excerpt has volume changes and fades; recorded voice uses gain 0.75. Export QA verifies the original source voice and music in the final mix. Subjective listening remains a separate review.

Local EB Garamond, Inter and JetBrains Mono are reused from the main HyperFrames composition, as is GSAP 3.14.2. The restrained name-rise/underline treatment follows the official registry component already inspected for the main film. Rebuilding overwrites generated HTML; preserve manual edits before rebuilding.
