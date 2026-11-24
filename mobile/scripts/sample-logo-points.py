#!/usr/bin/env python3
"""Sample the official app icon (assets/icon.png) into the points of the entry animation.

Writes two files (run again only when the icon changes):
- src/lib/logoPoints.ts: ~340 points {x, y, color} normalised to 0–1, picked by colour
  class (navy frame, navy cow head, orange scan corners, green fields) so the points of
  the entry animation (EntryIntro) form the whole logo when they land.
- src/lib/cowPoints.ts: the navy cow head alone, on a regular grid, for the loading
  animation (PondiLoader).


    python3 scripts/sample-logo-points.py            (from mobile/, needs Pillow)

Deterministic (fixed seed), so the committed file only changes with the icon.
"""
import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'icon.png'
OUT = ROOT / 'src' / 'lib' / 'logoPoints.ts'
COW_OUT = ROOT / 'src' / 'lib' / 'cowPoints.ts'
# Cow head region of the icon (fractions of the icon) and grid step, for the loader.
COW_BOX = (0.19, 0.10, 0.81, 0.71)
COW_STEP = 0.018
GRID = 256  # analysis resolution (the icon is 1024 px)

# How many points per class: denser on the cow head and the frame.
QUOTA = {'cow': 140, 'frame': 100, 'orange': 32, 'green': 58, 'greenDark': 10}
# Minimum spacing between points of the same class, in GRID pixels.
SPACING = {'cow': 3.2, 'frame': 3.6, 'orange': 2.6, 'green': 5.6, 'greenDark': 3.2}
# Point colours (sampled from the icon, rounded to the brand palette).
PALETTE = {'navy': '#14295A', 'orange': '#F26B1D', 'green': '#4E9A2E', 'greenDark': '#1F5A1E'}
CLASS_COLOR = {'cow': 'navy', 'frame': 'navy', 'orange': 'orange', 'green': 'green', 'greenDark': 'greenDark'}


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


def main():
    img = Image.open(SRC).convert('RGB').resize((GRID, GRID), Image.LANCZOS)
    px = img.load()
    buckets = {k: [] for k in QUOTA}
    for y in range(GRID):
        for x in range(GRID):
            c = classify(*px[x, y])
            if c is None:
                continue
            if c == 'navy':
                # The frame is the outer ring; everything inside is the cow head.
                edge = min(x, y, GRID - 1 - x, GRID - 1 - y)
                c = 'frame' if edge < 0.085 * GRID else 'cow'
            buckets[c].append((x, y))

    rng = random.Random(20261124)
    points = []
    for cls, quota in QUOTA.items():
        cand = buckets[cls][:]
        rng.shuffle(cand)
        picked = []
        min_d2 = SPACING[cls] ** 2
        for (x, y) in cand:
            if all((x - a) ** 2 + (y - b) ** 2 >= min_d2 for a, b in picked):
                picked.append((x, y))
                if len(picked) >= quota:
                    break
        for (x, y) in picked:
            points.append((round((x + 0.5) / GRID, 3), round((y + 0.5) / GRID, 3), CLASS_COLOR[cls]))
        print(f'{cls:10s} {len(picked):4d} points (of {len(buckets[cls])} pixels)')

    # Stable order mixed across classes so a reduced count (web) still covers the whole logo.
    rng.shuffle(points)
    colors = list(PALETTE)
    lines = [
        '// GERADO por scripts/sample-logo-points.py a partir de assets/icon.png — não editar à mão.',
        '// Pontos da animação de entrada: [x, y, cor] normalizados 0–1 (cor = índice em LOGO_POINT_COLORS).',
        f'export const LOGO_POINT_COLORS = {{ {", ".join(f"{k}: {chr(39)}{v}{chr(39)}" for k, v in PALETTE.items())} }} as const;',
        f'export type LogoPointColor = keyof typeof LOGO_POINT_COLORS;',
        f'const C: LogoPointColor[] = [{", ".join(chr(39) + c + chr(39) for c in colors)}];',
        '// prettier-ignore',
        'const RAW: readonly number[] = [',
    ]
    row = []
    for (x, y, c) in points:
        row.append(f'{x},{y},{colors.index(c)}')
        if len(row) == 8:
            lines.append('  ' + ', '.join(row) + ',')
            row = []
    if row:
        lines.append('  ' + ', '.join(row) + ',')
    lines += [
        '];',
        'export type LogoPoint = { x: number; y: number; color: LogoPointColor };',
        'export const LOGO_POINTS: readonly LogoPoint[] = Array.from({ length: RAW.length / 3 }, (_, i) => ({',
        '  x: RAW[i * 3], y: RAW[i * 3 + 1], color: C[RAW[i * 3 + 2]],',
        '}));',
        '',
    ]
    OUT.write_text('\n'.join(lines))
    print(f'{len(points)} points -> {OUT.relative_to(ROOT)}')


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
        '// GERADO por scripts/sample-logo-points.py a partir de assets/icon.png — não editar à mão.',
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
    main()
    cow()
