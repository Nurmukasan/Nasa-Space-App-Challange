# Interior art pipeline

Build-time tools for the lander interior. They need Python 3 with Pillow, numpy and scipy; nothing
here ships with the game. Sources are the team's pictures in `assets/raw/`.

1. Slice the tileset into the atlas and the tile grid:

   ```bash
   python3 -I tools/art/slice_tileset.py build assets/raw/tileset.png tools/art/tileset_names.json /tmp/interior assets/raw/base_reference.png
   ```

   `tileset_names.json` names every piece by its box on the sheet (sheet scaled to 1920 px = 64 px per
   tile). Pieces marked `"src": "reference"` are cut from `base_reference.png` (bridge consoles, wall
   map, hall wall panels: they are not on the sheet). Output: `atlas.webp` + `atlas.json` (props) and
   `tiles.webp` + `tiles.json` (64-px floor and wall tiles). `index` mode draws a numbered overview.

2. Build the map:

   ```bash
   python3 -I tools/art/build_base_map.py /tmp/interior/atlas.json /tmp/interior/tiles.json client/src/game/interior/data/base.tmj
   ```

3. Copy `atlas.webp` and `tiles.webp` to `client/public/assets/interior/` and `atlas.json` to
   `client/src/game/interior/data/`.

`base.tmj` is a Tiled map (30×17 tiles of 64 px). Layers: `Floor`, `Walls` (tiles with `collides`),
`Furniture/Props` (objects with `sprite`, `footprint` and optional `action`), `Doors`, `Decor/Overlay`
(drawn above the astronaut), `Markers` (spawn point and room outlines). It can be opened and edited
in Tiled; the game reads the same file (`client/src/game/interior/baseMap.ts`).
