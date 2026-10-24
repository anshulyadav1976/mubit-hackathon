# Final export review

Both delivery files were rendered locally with pinned HyperFrames 0.8.193 after strict final asset validation.

| Export | Duration | Picture | Frames | Size |
| --- | --- | --- | --- | --- |
| EVERAFTER-film.mp4 | 165.000 s | 1920×1080, 30 fps, H.264 | 4,950 | 53,503,248 bytes |
| EVERAFTER-teaser.mp4 | 20.000 s | 1920×1080, 30 fps, H.264 | 600 | 6,920,102 bytes |

Both include AAC audio. The main film has 19 edits and one continuous 32-second decision replay. The teaser has five edits. Files live in the workspace `outputs/` directory; private captures and QA are excluded from Git.

## Verification

- Six main build tests and four teaser tests pass. Strict gates reject missing/unverified footage and mismatched evidence.
- Final full main HyperFrames check: zero lint, runtime, layout or contrast errors/warnings. Two craft warnings cover intentionally compact 23–26 px proof annotations and the requested 26 px music credit. These were visually reviewed at full resolution. Teaser checks have no errors or warnings.
- Viewed all 19 scene midpoints and the authoring review's 18 transition strips. Viewed all 19 decoded final-video midpoint frames, with additional full-resolution review of proof, training status, reunion, chronicle and end card. Teaser final decoded frames cover all five cuts.
- Main full-file black-frame scan found no intervals at the recorded 60%/4%-luma threshold. Teaser scan also found none. The only main silence below −60 dB lasting 0.5 s is the intentional opening fade, 0–0.974 s.
- Recorded source audio survives every main voice segment: correlations 0.975–0.996, recovered gain approximately 0.75. Teaser voice correlation 0.996. Music correlations exceed 0.999, recovered gain approximately 0.12. This checks cross-composition audio inclusion.
- Main integrated loudness −21.7 LUFS, true peak −2.2 dBFS. Teaser −19.2 LUFS, true peak −4.7 dBFS. No clipping indicated. These are numeric checks, not a claim of full subjective listening.
- Main preview on port 3002 and teaser on 3004 both return HTTP 200. No foreground app activation was used.
- Generated HTML credential-pattern check found no matching token strings. Private capture evidence is not embedded wholesale in the film.

## Editorial scope

C03's synthetic player voice passes through the actual microphone/STT path. C07 replays that same captured request at original speed; it is not another call. The validated scene decision is actual guarded data, with a 4.154-second backend request measurement. It is a provisional chapter before entry. C07 keeps source framing; C10C is the documented pre-cropped book insert, page 1 only. Reunion footage is labelled as the recorded post-reunion state. The realm montage and guardian approaches are separate recorded highlights.

Historical session observations remain separate from the filmed trace. V2 corpus preparation is shown as offline work: submitted 0, kept unknown, target 50. No trained-v2, small-model savings, or arbitrary-world-generation claim is made.

The visible music credit and both READMEs credit Scott Buckley's Uprising under CC BY 4.0, with the primary source and modifications described. No cloud publication or paid model call was part of composition/rendering.
