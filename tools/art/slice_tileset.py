"""Slice tileset.png (team's 64-px top-down sheet, delivered upscaled x1.433) into sprites.

Step 1 (this file, `index` mode): find every prop on the sheet and write a numbered index
picture, so each piece can be named once in tools/art/tileset_names.json.
Step 2 (`build` mode): cut the named pieces at 64-px scale with the dark background and grid
removed, pack them into client/public/assets/interior/atlas.png + atlas.json.

    python3 -I tools/art/slice_tileset.py index <tileset.png> <out dir>
    python3 -I tools/art/slice_tileset.py build <tileset.png> <names.json> <out dir> [reference.png]

Pieces marked "src": "reference" are cut from base_reference.png instead (the bridge consoles,
the wall map and the hall wall panels are not on the sheet). Floor and wall tiles also go into
tiles.png, a plain 64-px grid for the Tiled tile layers.

Build-time tool only (Pillow, numpy, scipy); nothing here ships with the game.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

TILE = 64
SHEET_W = 1920  # the sheet's own size at 64 px per tile


def load(path):
    im = Image.open(path).convert('RGB')
    scale = SHEET_W / im.width
    size = (SHEET_W, round(im.height * scale))
    return im.resize(size, Image.LANCZOS), scale


def background(rgb):
    """Dark sheet background and its slightly lighter grid lines."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (r + g + b) / 3
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    return (lum < 64) & (sat < 30) & (b >= r - 2)


def components(rgb):
    solid = ~background(rgb)
    solid = ndimage.binary_opening(solid, iterations=1)
    # Join the parts of one prop (a plant and its pot, a desk and its screen).
    joined = ndimage.binary_closing(solid, iterations=4)
    lab, n = ndimage.label(joined)
    boxes = []
    for sl in ndimage.find_objects(lab):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        if (x1 - x0) * (y1 - y0) < 120:
            continue
        boxes.append((x0, y0, x1, y1))
    boxes.sort(key=lambda b: (b[1] // 40, b[0]))
    return boxes, solid


def index(sheet, out):
    im, _ = load(sheet)
    rgb = np.asarray(im).astype(int)
    boxes, _ = components(rgb)
    big = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        d.rectangle((x0 * 2, y0 * 2, x1 * 2, y1 * 2), outline=(255, 0, 255))
        d.text((x0 * 2 + 2, y0 * 2 + 2), str(i), fill=(255, 255, 0))
    big.save(f'{out}/index.png')
    json.dump([list(b) for b in boxes], open(f'{out}/boxes.json', 'w'))
    print(len(boxes), 'pieces')


def build(sheet, names_path, out, reference=None):
    sources = {'sheet': load(sheet)[0]}
    if reference:
        sources['reference'] = load(reference)[0]
    names = json.load(open(names_path))
    sprites = {}
    for name, spec in names.items():
        if spec.get('src') == 'clean':
            sprites[name] = clean(spec)
            continue
        im = sources[spec.get('src', 'sheet')]
        rgb = np.asarray(im).astype(int)
        x0, y0, x1, y1 = spec['box']
        crop = im.crop((x0, y0, x1, y1)).convert('RGBA')
        if spec.get('keepBackground'):
            alpha = np.full((y1 - y0, x1 - x0), 255, np.uint8)
        else:
            # Only background connected to the crop's border is removed, so dark screens and
            # panels inside a prop stay opaque.
            bg = background(rgb[y0:y1, x0:x1])
            lab, _ = ndimage.label(bg)
            edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
            outside = np.isin(lab, list(edge))
            alpha = (~outside * 255).astype(np.uint8)
        crop.putalpha(Image.fromarray(alpha))
        sprites[name] = (crop, spec)
    tiles(sprites, out)
    # Shelf packing, tallest first.
    # Floor and wall tiles live in tiles.png only.
    order = sorted((n for n in sprites if sprites[n][1].get('kind') not in ('floor', 'wall')),
                   key=lambda n: -sprites[n][0].height)
    width, x, y, row, frames = 2048, 0, 0, 0, {}
    for n in order:
        w, h = sprites[n][0].size
        if x + w > width:
            x, y, row = 0, y + row + 2, 0
        frames[n] = (x, y, w, h)
        x, row = x + w + 2, max(row, h)
    atlas = Image.new('RGBA', (width, y + row))
    meta = {'tile': TILE, 'frames': {}}
    for n, (fx, fy, w, h) in frames.items():
        crop, spec = sprites[n]
        atlas.paste(crop, (fx, fy))
        meta['frames'][n] = {
            'x': fx, 'y': fy, 'w': w, 'h': h,
            # Footprint in tiles used for collision, and the kind for the map script.
            'footprint': spec.get('footprint'),
            'kind': spec.get('kind', 'prop'),
            # Where the piece sits in the reference layout (sheet px = map px).
            'at': spec.get('at', spec['box'][:2]),
        }
    # Lossless WebP: every pixel of the sheet kept, a fraction of the PNG size.
    atlas.save(f'{out}/atlas.webp', 'WEBP', lossless=True, quality=100, method=6)
    json.dump(meta, open(f'{out}/atlas.json', 'w'), indent=1)
    print('atlas', atlas.size, len(frames), 'sprites')


CLEAN_DIR = 'assets/raw/clean'
SHEET_SRC_W = 2752  # tileset.png's own width; the clean cut-outs are at this size


def clean(spec):
    """A hand-cleaned cut-out (assets/raw/clean/): the sheet's own pixels with a clean alpha, used
    where the glow or shadows on the sheet would leave dirt around the piece (the reactor and its
    cables). Scaled like the sheet; 'at' is its top-left on the 2752-px sheet."""
    im = Image.open(f"{CLEAN_DIR}/{spec['file']}").convert('RGBA')
    s = SHEET_W / SHEET_SRC_W
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    a = np.asarray(im).copy()
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    x, y = round(spec['at'][0] * s), round(spec['at'][1] * s)
    spec = dict(spec, box=[x, y, x + im.width, y + im.height], at=[x, y])
    return Image.fromarray(a), spec


WALL_DARK = (29, 32, 40)
WALL_RIM = (88, 96, 108)
WALL_EDGE = (52, 57, 67)


def tiles(sprites, out):
    """tiles.png: 64-px grid for the Tiled tile layers. Index = Tiled local tile id."""
    order = [n for n, (_, spec) in sprites.items() if spec.get('kind') in ('floor', 'wall')]
    cells = []
    for n in order:
        crop = sprites[n][0]
        cell = Image.new('RGBA', (TILE, TILE))
        cell.paste(crop.resize((TILE, TILE), Image.NEAREST) if crop.size != (TILE, TILE) else crop)
        cells.append((n, cell))
    # The thick hull walls of the reference are flat dark bands with a grey frame on every side
    # that faces a room. The sheet only has front-facing wall panels, so these are plain fills:
    # wall_N, wall_NE, ... name the sides that get the frame (N, E, S, W).
    for mask in range(16):
        sides = ''.join(ch for bit, ch in zip((1, 2, 4, 8), 'NESW') if mask & bit)
        cell = Image.new('RGBA', (TILE, TILE), WALL_DARK + (255,))
        d = ImageDraw.Draw(cell)
        for ch in sides:
            box = {'N': (0, 0, TILE - 1, 5), 'S': (0, TILE - 6, TILE - 1, TILE - 1),
                   'W': (0, 0, 5, TILE - 1), 'E': (TILE - 6, 0, TILE - 1, TILE - 1)}[ch]
            d.rectangle(box, fill=WALL_RIM)
            inner = {'N': (0, 5, TILE - 1, 6), 'S': (0, TILE - 7, TILE - 1, TILE - 6),
                     'W': (5, 0, 6, TILE - 1), 'E': (TILE - 7, 0, TILE - 6, TILE - 1)}[ch]
            d.rectangle(inner, fill=WALL_EDGE)
        cells.append((f'wall_{sides or "dark"}', cell))
    # Invisible collider for a room's back wall: the wall art is drawn by props on top of the floor.
    cells.append(('wall_back', Image.new('RGBA', (TILE, TILE))))
    cols = 8
    rows = (len(cells) + cols - 1) // cols
    grid = Image.new('RGBA', (cols * TILE, rows * TILE))
    for i, (n, cell) in enumerate(cells):
        grid.paste(cell, ((i % cols) * TILE, (i // cols) * TILE))
    grid.save(f'{out}/tiles.webp', 'WEBP', lossless=True, quality=100, method=6)
    json.dump({'tile': TILE, 'columns': cols, 'names': [n for n, _ in cells]},
              open(f'{out}/tiles.json', 'w'), indent=1)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'index':
        index(sys.argv[2], sys.argv[3])
    else:
        build(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)
