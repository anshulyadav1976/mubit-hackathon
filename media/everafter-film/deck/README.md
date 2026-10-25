# EVERAFTER PDF deck

Six 16:9 slides, generated with ReportLab and Pillow. This is the submission deck, not the video composition. No provider or runtime calls are made.

Use any Python 3 with the required packages (`pip install reportlab pillow pypdf`):

```sh
PYTHON=python3
"$PYTHON" media/everafter-film/deck/build.py
```

This writes `outputs/EVERAFTER-deck.preview.pdf` in the outer workspace. Missing captures have explicitly labelled placeholders. Map the four entries in `stills.json` to actual image filenames under the outer workspace's `work/film-data/stills` directory. The same real image may be used for more than one slot when appropriate; filenames are relative to that directory. Images are center-cropped without alteration or regeneration.

```sh
"$PYTHON" media/everafter-film/deck/build.py --final
```

The final build writes `outputs/EVERAFTER-deck.pdf` in the outer workspace. It refuses missing, corrupt, undersized (below 640x360), or nearly flat images in any slot. This check detects empty assets; a human must still verify that all images are genuine, suitable game captures. `--stills`, `--manifest` and `--output` can override the paths for offline builds. macOS Georgia, Arial and Courier New fonts are embedded.

Render all six pages using `pdftoppm` (from poppler), then inspect every page before handing off the final PDF. `test_deck.py` checks the image gate and the six-page build; it does not replace visual review. Fonts prefer macOS Georgia, Arial and Courier New, then common Linux serif/sans/mono fonts, then ReportLab's built-ins.

The evidence slide is explicitly historical: the completed Ember Keep story-v2 run recorded 13 Mubit responses, zero local fallbacks, zero provider errors, 40,197 reported tokens and a confirmed reunion. Images do not claim to depict those exact recorded turns. The corpus is prepared: 240 turns / 60 sessions plus 60 holdouts / 15 separate sessions. 100 candidate turns were submitted on 25 October; Mubit-kept unknown, target 50. No adapter improvement, verified serving, price or savings is claimed. Update these facts only from verified source evidence.

The mapped stills are actual game captures supplied and verified by the capture owner. Ember shows a separate-run Warden fight; reunion shows Mara and Elin together in the new Sunken film run. The final slide credits the film music: "Uprising" by Scott Buckley, CC BY 4.0, www.scottbuckley.com.au. The PDF itself contains no audio.
