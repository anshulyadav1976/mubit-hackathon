import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from pypdf import PdfReader

from build import Deck, SLOTS, load_images, register_fonts


class DeckTest(unittest.TestCase):
    def test_final_rejects_missing_corrupt_small_and_blank_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / 'stills.json'
            for name in [None, 'absent.png', 'corrupt.png', 'small.png', 'blank.png']:
                if name == 'corrupt.png':
                    (root / name).write_text('not an image')
                elif name == 'small.png':
                    Image.effect_noise((320, 180), 80).save(root / name)
                elif name == 'blank.png':
                    Image.new('RGB', (960, 540), 'black').save(root / name)
                manifest.write_text(json.dumps({slot: name for slot in SLOTS}))
                with self.assertRaisesRegex(ValueError, 'actual game image'):
                    load_images(root, manifest, final=True)

    def test_preview_has_six_widescreen_pages_and_explicit_evidence_scope(self):
        register_fonts()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'preview.pdf'
            Deck(output, {slot: None for slot in SLOTS}, final=False).save()
            pdf = PdfReader(output)
            self.assertEqual(len(pdf.pages), 6)
            for page in pdf.pages:
                self.assertEqual((float(page.mediabox.width), float(page.mediabox.height)), (960, 540))
            text = '\n'.join(page.extract_text() for page in pdf.pages)
            for phrase in ['ACTUAL GAME IMAGE PENDING', '240 turns / 60 sessions', '60 holdouts / 15 separate sessions', 'Mubit-kept unknown', 'Historical Ember Keep session', '40,197', 'not a held-out quality score', 'Uprising - Scott Buckley / CC BY 4.0']:
                self.assertIn(phrase, text)
            self.assertIn('PREVIEW', text)


if __name__ == '__main__':
    unittest.main()
