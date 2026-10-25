#!/usr/bin/env python3
"""Build the six-slide EVERAFTER submission deck from actual game stills."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageStat
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[3]
WORKSPACE = ROOT.parent
W, H = 960, 540
INK, PAPER, GOLD, TEAL, MUTED, PANEL = map(HexColor, ["#101719", "#F0E8D6", "#E9AD5A", "#8BC9C0", "#A7B1AE", "#1B2729"])
SLOTS = ("village", "ember", "conversation", "reunion")


FONT_SEARCH_DIRS = (
    '/System/Library/Fonts/Supplemental',
    '/Library/Fonts',
    '/usr/share/fonts/truetype/msttcorefonts',
    '/usr/share/fonts/truetype/dejavu',
    '/usr/share/fonts/truetype/liberation',
    '/usr/share/fonts/truetype/liberation2',
    '/usr/share/fonts/liberation-serif',
    '/usr/share/fonts/liberation-sans',
    '/usr/share/fonts/liberation-mono',
)
FONT_CANDIDATES = {
    'Story': ('Georgia.ttf', 'DejaVuSerif.ttf', 'LiberationSerif-Regular.ttf'),
    'StoryBold': ('Georgia Bold.ttf', 'DejaVuSerif-Bold.ttf', 'LiberationSerif-Bold.ttf'),
    'Body': ('Arial.ttf', 'arial.ttf', 'DejaVuSans.ttf', 'LiberationSans-Regular.ttf'),
    'BodyBold': ('Arial Bold.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Bold.ttf'),
    'Mono': ('Courier New.ttf', 'cour.ttf', 'DejaVuSansMono.ttf', 'LiberationMono-Regular.ttf'),
}
BUILTIN_FONTS = {'Story': 'Times-Roman', 'StoryBold': 'Times-Bold', 'Body': 'Helvetica', 'BodyBold': 'Helvetica-Bold', 'Mono': 'Courier'}
FONTS = dict(BUILTIN_FONTS)


def register_fonts():
    for name, filenames in FONT_CANDIDATES.items():
        for filename in filenames:
            path = next((Path(directory) / filename for directory in FONT_SEARCH_DIRS if (Path(directory) / filename).is_file()), None)
            if path:
                pdfmetrics.registerFont(TTFont(name, str(path)))
                FONTS[name] = name
                break


def load_images(stills, manifest, final=False):
    records = json.loads(manifest.read_text()) if manifest.exists() else {slot: None for slot in SLOTS}
    images = {}
    for slot in SLOTS:
        value = records.get(slot)
        path = (stills / value).resolve() if isinstance(value, str) else None
        valid = False
        if path and path.is_file():
            try:
                with Image.open(path) as image:
                    valid = image.width >= 640 and image.height >= 360 and max(ImageStat.Stat(image.convert('RGB')).stddev) > 5
            except (OSError, ValueError):
                pass
        if final and not valid:
            raise ValueError(f'Final deck requires a non-empty actual game image for {slot}')
        images[slot] = path if valid else None
    return images


class Deck:
    def __init__(self, output, images, final):
        self.c = canvas.Canvas(str(output), pagesize=(W, H), pageCompression=1)
        self.c.setTitle('EVERAFTER - Bring her home. Your way.')
        self.c.setAuthor('EVERAFTER')
        self.c.setSubject('Playable Minecraft narrative director - Mubit Night Shift')
        self.images, self.final, self.page = images, final, 0

    def text(self, text, x, y, size=16, font='Body', color=PAPER):
        self.c.setFillColor(color)
        self.c.setFont(FONTS.get(font, font), size)
        self.c.drawString(x, y, text)

    def paragraph(self, text, x, y, width, size=15, leading=22, color=PAPER, font='Body', max_lines=10):
        words, lines, line = text.split(), [], ''
        for word in words:
            candidate = f'{line} {word}'.strip()
            if pdfmetrics.stringWidth(candidate, FONTS.get(font, font), size) > width and line:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
        if len(lines) > max_lines or y - (len(lines) - 1) * leading < 45:
            raise ValueError(f'Text does not fit: {text[:45]}')
        for index, value in enumerate(lines):
            self.text(value, x, y - index * leading, size, font, color)
        return y - len(lines) * leading

    def rect(self, x, y, w, h, color=PANEL, radius=0):
        self.c.setFillColor(color)
        self.c.roundRect(x, y, w, h, radius, fill=1, stroke=0)

    def rule(self, x, y, width, color=TEAL):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(1)
        self.c.line(x, y, x + width, y)

    def image(self, slot, x, y, width, height, placeholder_label=True):
        image = self.images[slot]
        if image:
            with Image.open(image) as source:
                iw, ih = source.size
            scale = max(width / iw, height / ih)
            self.c.saveState()
            path = self.c.beginPath()
            path.rect(x, y, width, height)
            self.c.clipPath(path, stroke=0)
            self.c.drawImage(ImageReader(str(image)), x + (width - iw * scale) / 2, y + (height - ih * scale) / 2, iw * scale, ih * scale)
            self.c.restoreState()
        else:
            self.rect(x, y, width, height)
            self.c.setStrokeColor(TEAL)
            self.c.setLineWidth(0.5)
            self.c.rect(x + 10, y + 10, width - 20, height - 20, fill=0, stroke=1)
            if placeholder_label:
                self.text('ACTUAL GAME IMAGE PENDING', x + 25, y + height / 2 + 8, min(14, width / 24), 'Mono', TEAL)
                self.text(slot.upper(), x + 25, y + height / 2 - 18, 11, 'Mono', MUTED)

    def begin(self, section, title=None, subtitle=None):
        self.page += 1
        self.rect(0, 0, W, H, INK)
        self.text('EVERAFTER', 48, 505, 11, 'StoryBold', GOLD)
        self.text(section.upper(), 48, 473, 10, 'Mono', TEAL)
        if title:
            self.text(title, 48, 425, 32, 'Story')
        if subtitle:
            self.text(subtitle, 48, 395, 14, color=MUTED)

    def end(self):
        self.rule(48, 35, 864, HexColor('#344144'))
        self.text('MUBIT NIGHT SHIFT  /  MINECRAFT JAVA PROTOTYPE', 48, 20, 8, 'Mono', MUTED)
        self.text(f'{self.page:02d} / 06', 862, 20, 8, 'Mono', MUTED)
        if not self.final:
            self.text('PREVIEW - CAPTURE ASSETS MAY BE MISSING', 315, 20, 8, 'Mono', GOLD)
        self.c.showPage()

    def title(self):
        self.begin('A story you can speak to')
        self.image('village', 0, 40, W, 448, placeholder_label=False)
        self.c.saveState()
        for i in range(48):
            self.rect(i * 20, 40, 20, 448, Color(16/255, 23/255, 25/255, alpha=max(.18, .98 - i * .022)))
        self.c.restoreState()
        if not self.images['village']:
            self.text('ACTUAL GAME IMAGE PENDING', 550, 260, 13, 'Mono', TEAL)
        self.text('A STORY YOU CAN SPEAK TO', 48, 445, 11, 'Mono', TEAL)
        self.text('EVERAFTER', 45, 342, 57, 'StoryBold')
        self.text('Bring her home.', 48, 277, 35, 'Story', GOLD)
        self.text('Your way.', 48, 232, 35, 'Story', GOLD)
        self.paragraph('Speak with six characters. Shape a chapter. Bring Elin back to the village.', 50, 166, 365, 16, 24, max_lines=3)
        self.text('PLAYABLE MINECRAFT JAVA PROTOTYPE', 50, 73, 10, 'Mono', TEAL)
        self.end()

    def journey(self):
        self.begin('01 / The adventure', 'One journey. More than one way.', 'Four authored realms. Three trials. Three twists.')
        self.image('ember', 48, 147, 459, 222)
        self.text('EMBER KEEP  /  SUNKEN ARCHIVE', 48, 122, 11, 'Mono', GOLD)
        self.text('SKY MONASTERY  /  THORNWILD', 48, 102, 11, 'Mono', GOLD)
        steps = [('Speak with Mara', 'Choose a lead; correct it before entry.'), ('Cross into a chapter', 'Mystery, combat or a hybrid approach.'), ('Prove the trial', 'Riddle, gauntlet or parley.'), ('Face two guardians', 'Sentinel, then the larger Warden.'), ('Rescue and escort Elin', 'She physically follows you home.'), ('Return to the village', 'Reunion, reward and a factual chronicle.')]
        for i, (title, caption) in enumerate(steps):
            y = 357 - i * 45
            self.text(f'{i+1:02d}', 542, y, 11, 'Mono', TEAL)
            self.text(title, 577, y, 17, 'BodyBold')
            self.text(caption, 577, y - 19, 11, color=MUTED)
        self.text('TWISTS: BROKEN OATH / FALSE TRAIL / WILLING GUARDIAN', 48, 63, 10, 'Mono', MUTED)
        self.end()

    def architecture(self):
        self.begin('02 / The system', 'A director with boundaries.', 'The model proposes. The game owns evidence, progress and consequences.')
        cards = [(48, '01  PLAYER', 'Choose in your own words.', 'Voice or typed conversation with a nearby character.'), (346, '02  MUBIT TEXT', 'Propose structured JSON.', 'Dialogue, chapter, approach, mood, difficulty and intent.'), (644, '03  PAPER SERVER', 'Validate. Then act.', 'Check stage, reach, clue, artifact and actual combat results.')]
        for x, label, heading, body in cards:
            self.rect(x, 205, 268, 157, radius=5)
            self.rule(x + 18, 339, 232)
            self.text(label, x + 18, 317, 11, 'Mono', TEAL)
            self.paragraph(heading, x + 18, 283, 232, 19, 24, font='Story', max_lines=2)
            self.paragraph(body, x + 18, 238, 231, 13, 19, color=MUTED, max_lines=2)
        for x in [321, 619]:
            self.text('>', x, 275, 19, 'Mono', GOLD)
        self.text('VOICE IS A SEPARATE PATH', 48, 165, 10, 'Mono', GOLD)
        self.text('Microphone  /  local Whisper  /  text       NPC reply  /  OpenRouter speech  /  in-game audio', 48, 136, 13)
        self.paragraph('Text uses Mubit only. Failure uses labelled deterministic local dialogue. Scenes are authored assemblies; AI selects bounded plans.', 48, 93, 845, 13, 20, color=MUTED, max_lines=2)
        self.end()

    def adaptation(self):
        self.begin('03 / The recurring task', 'Change your mind. Keep the story.', 'Corrections work before entry. Committed chapters remain consistent.')
        self.image('conversation', 48, 145, 400, 223)
        self.paragraph('The same bounded dialogue-and-decision contract recurs across characters and quest stages.', 48, 118, 390, 14, 20, color=MUTED, max_lines=3)
        self.text('OFFLINE V2 CORPUS PREPARED', 492, 351, 11, 'Mono', TEAL)
        self.text('240 turns / 60 sessions', 492, 312, 24, 'Story')
        self.text('60 holdouts / 15 separate sessions', 492, 278, 18, 'Story', GOLD)
        self.rule(492, 254, 420)
        self.text('Submitted 100   /   Mubit-kept unknown', 492, 227, 14, 'BodyBold')
        self.text('Target: 50 kept examples', 492, 200, 15, color=TEAL)
        self.paragraph('Next: provider curation, training, a held-out comparison, then verified serving.', 492, 158, 398, 15, 22, max_lines=3)
        self.text('PREPARED DOES NOT MEAN KEPT, TRAINED OR SERVING.', 492, 69, 9, 'Mono', MUTED)
        self.end()

    def evidence(self):
        self.begin('04 / What is verified', 'A completed run, with receipts.', 'Historical Ember Keep session / story-v2 contract / 24 October 2026')
        for x, value, label in [(48, '13', 'MUBIT RESPONSES'), (207, '0', 'LOCAL FALLBACKS'), (366, '0', 'PROVIDER ERRORS')]:
            self.text(value, x, 305, 58, 'Story', TEAL if value == '0' else GOLD)
            self.text(label, x, 277, 9, 'Mono', MUTED)
        self.text('40,197', 48, 215, 32, 'Story')
        self.text('reported tokens across this session', 48, 191, 13, color=MUTED)
        self.text('Elin rescued. Village reunion confirmed.', 48, 145, 16, 'BodyBold')
        self.text('Shared native playthrough; human-assisted combat.', 48, 120, 12, color=MUTED)
        self.image('reunion', 548, 157, 364, 212)
        self.text('Prototype image / metrics refer to the prior session', 548, 138, 9, color=MUTED)
        self.paragraph('Integration evidence, not a held-out quality score or adapter evaluation. Other realms and peaceful branches have automated coverage; four native campaign completions are not claimed.', 48, 77, 855, 12, 17, color=MUTED, max_lines=2)
        self.end()

    def ending(self):
        self.begin('05 / Where it can go')
        self.image('reunion', 432, 40, 528, 448)
        self.rect(0, 40, 432, 448, INK)
        self.text('A RESCUE TODAY.', 48, 446, 11, 'Mono', TEAL)
        self.text('An RPG director', 48, 387, 32, 'Story')
        self.text('tomorrow.', 48, 346, 32, 'Story')
        self.paragraph('A potential narrative toolkit for RPG creators and private servers.', 48, 285, 335, 18, 26, max_lines=3)
        self.paragraph('Reusable decision contracts. Authored encounter catalogues. Consequences the game can verify.', 48, 187, 335, 15, 23, color=MUTED, max_lines=3)
        self.text('EVERAFTER', 48, 89, 24, 'StoryBold', GOLD)
        self.text('Bring her home. Your way.', 48, 62, 15, 'Story')
        self.rect(432, 40, 528, 24, INK)
        self.text('Music: Uprising - Scott Buckley / CC BY 4.0 / www.scottbuckley.com.au', 448, 49, 8, color=MUTED)
        self.c.linkURL('https://www.scottbuckley.com.au/', (448, 45, 904, 59), relative=0, thickness=0)
        self.end()

    def save(self):
        for slide in (self.title, self.journey, self.architecture, self.adaptation, self.evidence, self.ending):
            slide()
        self.c.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stills', type=Path, default=WORKSPACE / 'work/film-data/stills')
    parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('stills.json'))
    parser.add_argument('--output', type=Path)
    parser.add_argument('--final', action='store_true', help='Reject every missing, undersized or near-flat image')
    args = parser.parse_args()
    images = load_images(args.stills, args.manifest, args.final)
    register_fonts()
    output = args.output or WORKSPACE / ('outputs/EVERAFTER-deck.pdf' if args.final else 'outputs/EVERAFTER-deck.preview.pdf')
    output.parent.mkdir(parents=True, exist_ok=True)
    Deck(output, images, args.final).save()
    print(output)


if __name__ == '__main__':
    main()
