#!/usr/bin/env python3
"""Sample the cow head of the official app icon (assets/icon.png) into dots.

Writes src/lib/cowPoints.ts: the navy cow head on a regular grid, normalised to the
head box (x 19-81 %, y 10-71 % of the icon). Used by the loading animation
(PondiLoader), the empty states (EmptyState) and the opening animation
(EntryAnimation). Run again only when the icon changes:

    python3 scripts/sample-cow-points.py            (from mobile/, needs Pillow)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'icon.png'
COW_OUT = ROOT / 'src' / 'lib' / 'cowPoints.ts'
# Cow head region of the icon (fractions of the icon) and grid step.
COW_BOX = (0.19, 0.10, 0.81, 0.71)
COW_STEP = 0.018


def classify(r, g, b):
    if r < 40 and g < 40 and b < 40:
        return None  # black outside the rounded frame
    if r > 200 and g > 200 and b > 200:
        return None  # white
    if r > 190 and 60 < g < 160 and b < 90:
        return 'orange'
    if g > r + 15 and g > b + 15:
        return 'greenDark' if g < 75 else 'green'
    if b > r + 15 and b >= g and r < 90:
        return 'navy'
    return None


def cow():
    """Navy pixels of the cow head on a regular grid (majority vote in a 5×5 patch)."""
    img = Image.open(SRC).convert('RGB')
    w, h = img.size
    px = img.load()
    x0, y0, x1, y1 = COW_BOX
    pts = []
    ny = int(round((y1 - y0) / COW_STEP))
    nx = int(round((x1 - x0) / COW_STEP))
    for j in range(ny + 1):
        for i in range(nx + 1):
            fx, fy = x0 + i * COW_STEP, y0 + j * COW_STEP
            cx, cy = int(fx * w), int(fy * h)
            votes = sum(
                classify(*px[min(w - 1, max(0, cx + dx)), min(h - 1, max(0, cy + dy))]) == 'navy'
                for dx in range(-4, 5, 2) for dy in range(-4, 5, 2)
            )
            if votes >= 13:
                pts.append((round((fx - x0) / (x1 - x0), 3), round((fy - y0) / (y1 - y0), 3)))
    lines = [
        '// GERADO por scripts/sample-cow-points.py a partir de assets/icon.png — não editar à mão.',
        '// Cabeça de bovino do ícone (só o azul-noite), em grelha regular, para o PondiLoader.',
        f'// Coordenadas 0–1 dentro da caixa da cabeça (x {x0:.0%}–{x1:.0%}, y {y0:.0%}–{y1:.0%} do ícone).',
        '// prettier-ignore',
        'const RAW: readonly number[] = [',
    ]
    for k in range(0, len(pts), 10):
        lines.append('  ' + ', '.join(f'{x},{y}' for x, y in pts[k:k + 10]) + ',')
    lines += [
        '];',
        'export const COW_POINTS: readonly { x: number; y: number }[] = Array.from({ length: RAW.length / 2 }, (_, i) => ({ x: RAW[i * 2], y: RAW[i * 2 + 1] }));',
        '',
    ]
    COW_OUT.write_text('\n'.join(lines))
    print(f'{len(pts)} cow points -> {COW_OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    cow()
