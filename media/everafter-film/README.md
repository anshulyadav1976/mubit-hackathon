# EVERAFTER film package

Creative direction: **Bring her home. Your way.** The main film is 165 seconds at 1920×1080/30fps; the teaser is 20 seconds. A six-slide PDF accompanies the video. Local final exports live in the outer workspace's `outputs/` directory. No submission or public video upload is performed by these tools.

- [Editable main film](composition/README.md): HyperFrames 0.8.193, nineteen picture edits, local fonts and GSAP, measured evidence graphics and licensed music.
- [Editable teaser](teaser/README.md): five scenes reusing the same genuine game footage.
- [PDF deck](deck/README.md): six widescreen slides built with ReportLab and actual game stills.
- [Minecraft recorder](tools/README.md): native ScreenCaptureKit capture, system audio, focus guards, no room microphone.
- [Original storyboard](production.md), [timeline](timeline.csv), and [evidence contract](evidence-contract.md): creative references. The local verified capture manifest and generated composition describe the final edit; the storyboard's proposed shots are not claims that those events were captured.

## What the final edit demonstrates

The recorded voice choice selects Ember Keep. A typed correction in the same uncommitted session selects the Sunken Archive, followed by actual entry. The 32-second proof segment is explicitly a **decision replay**, using one continuous original take at normal speed. Its structured overlay is the validated application decision, not retained raw provider output. Its observed consequence is a provisional chapter selection; it does not claim the replay itself builds or unlocks a world. C03 and C07 show the same request and must never be counted twice.

The player prompt is synthetic speech played into the real microphone to exercise the actual recording and local STT path; its label stays visible. The NPC reply is genuine in-game audio. The transcript preserves recognition errors. Other shots show four authored realms, scripted guardian encounters, Elin's refuge, Mara and Elin together after completion, and a close-up of page one of the actual chronicle. The encounters are not presented as captured boss victories. The book insert is cropped for readability; the continuous proof is uncropped. Ending and encounter highlights are muted under the music rather than substituting invented character speech.

Evidence graphics distinguish **historical integration observations** (13 Mubit replies, zero local fallbacks, zero provider errors in that documented completed Ember session) from the separate filmed request and the prepared story-v2 dataset. The later Sunken filming run had four Mubit replies and two labelled local fallbacks after `503 engine_unavailable`; it is not the source of the 13/0/0 card. A passing adapter, small-model serving, quality improvement, training acceptance, cost savings and latency savings remain unverified.

The frozen corpus contains 240 candidate turns across 60 sessions and 60 held-out turns across 15 separate sessions. It is prepared locally: 100 candidate turns were submitted on 25 October; the Mubit-kept count is unknown, target 50. See [preparation details](../../docs/story-v2-training-preparation.md).

## Local inputs and checks

Footage, music, capture manifests, private provenance and rendered QA frames are Git-ignored. `composition/build.mjs --final` rejects missing/unverified footage, insufficient durations and an unmatched proof trace. A clone must import its own genuine footage and sanitized evidence; there is no replacement stock gameplay or fabricated console.

Run the documented strict builds, tests and HyperFrames checks, inspect snapshots and representative decoded final frames, and verify duration and audio before delivery. The original `asset-manifest.json` and `session-evidence.template.json` are empty planning templates, not live counts.

## Submission and credits

Organizer Discord specifies an MP4/MOV of at most three minutes plus a PDF deck, without a YouTube link ([video/deck requirement](https://discord.com/channels/1531252044885921872/1562531784523120760/1562532028610642052)). The final push/submission freeze is Sunday 25 October at 07:00 London time, after the daylight-saving change ([organizer schedule](https://discord.com/channels/1531252044885921872/1531279845365907478/1563600460835983502)). The [event brief](https://luma.com/nightshift-london) supplies the three tracks and four judging criteria; [our judging argument](../../docs/judging.md) separates implemented evidence from missing adapter proof.

Music: **'Uprising' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au**. [Original music and license](https://www.scottbuckley.com.au/library/uprising/); [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The film edits its duration, fades and mix level. Credit is visible in the film/teaser and included in the deck. Preserve that credit when sharing.

GSAP 3.14.2 retains its copyright/license header and is subject to the [GSAP Standard License](https://gsap.com/standard-license/). Font license texts are bundled in `licenses/`. Minecraft is the demonstration environment; this is an independent hackathon prototype, not an official Minecraft product.
