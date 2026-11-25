#!/usr/bin/env python3
"""Generate assets/splash-icon.png: the first frame of the opening animation.

Only the four orange scan corner brackets on the deep PondiFarm navy, at the size and
place EntryAnimation draws them (src/lib/entryStage.ts: stage = 37.3 % of the screen
width, centred at 42 % of the height). The image has the aspect of an iPhone screen
(402 x 874 pt at 3x) and app.json uses resizeMode "cover", so splash -> animation is
seamless. Keep the constants below equal to src/lib/entryStage.ts.

    python3 scripts/make-splash.py            (from mobile/, needs Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'splash-icon.png'

W_PT, H_PT, SCALE = 402, 874, 3          # iPhone 17 Pro, points and pixel scale
BG = (0x0F, 0x22, 0x34, 255)             # INTRO_BG
ORANGE = (0xE8, 0x79, 0x2C, 255)
STAGE_PHONE, STAGE_CY = 0.373, 0.42      # entryStage.ts
PAD, ARM, STROKE, RADIUS = 0.08, 0.22, 0.027, 0.05
SS = 4                                   # supersampling for smooth edges


def main():
    k = SCALE * SS
    w, h = W_PT * k, H_PT * k
    img = Image.new('RGBA', (w, h), BG)
    d = ImageDraw.Draw(img)
    s = round(W_PT * STAGE_PHONE)                     # stage in pt (Math.round)
    left, top = (W_PT - s) / 2, H_PT * STAGE_CY - s / 2
    pad, stroke, arm, r = s * PAD, max(3, s * STROKE), s * ARM, s * RADIUS
    x0, y0 = left - pad + stroke / 2, top - pad + stroke / 2
    x1, y1 = left + s + pad - stroke / 2, top + s + pad - stroke / 2
    sw = round(stroke * k)

    def line(ax, ay, bx, by):
        d.line([(ax * k, ay * k), (bx * k, by * k)], fill=ORANGE, width=sw)
        for (cx, cy) in ((ax, ay), (bx, by)):   # round caps
            d.ellipse([cx * k - sw / 2, cy * k - sw / 2, cx * k + sw / 2, cy * k + sw / 2], fill=ORANGE)

    def arc(cx, cy, start):
        box = [(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k]
        d.arc(box, start, start + 90, fill=ORANGE, width=sw)

    # top-left, top-right, bottom-right, bottom-left
    line(x0, y0 + arm, x0, y0 + r); line(x0 + r, y0, x0 + arm, y0); arc(x0 + r, y0 + r, 180)
    line(x1 - arm, y0, x1 - r, y0); line(x1, y0 + r, x1, y0 + arm); arc(x1 - r, y0 + r, 270)
    line(x1, y1 - arm, x1, y1 - r); line(x1 - r, y1, x1 - arm, y1); arc(x1 - r, y1 - r, 0)
    line(x0 + arm, y1, x0 + r, y1); line(x0, y1 - r, x0, y1 - arm); arc(x0 + r, y1 - r, 90)

    img = img.resize((W_PT * SCALE, H_PT * SCALE), Image.LANCZOS)
    img.save(OUT, optimize=True)
    print(f'{OUT.relative_to(ROOT)}: {img.size[0]}x{img.size[1]}')


if __name__ == '__main__':
    main()
