# References

Everything used in the project that the team did not make: data, audio, images, fonts, code.
One line each: what, where it is used, link, license/credit. Required for the Space Apps submission.

## NASA data and resources

| What | Used for | Link | Credit |
| --- | --- | --- | --- |
| InSight mission results | Seismic/wind/impact distinctions and the InSight mission twin, based on the supplied product specification | https://science.nasa.gov/mission/insight/science-highlights | NASA / JPL-Caltech |
| InSight observed impact | Impact-crater and exposed-ice game concept, based on the supplied product specification | https://www.nasa.gov/missions/insight/nasas-insight-lander-detects-stunning-meteoroid-impact-on-mars/ | NASA / JPL-Caltech |

The supplied `docs/product-logic.md` records the educational sources and deliberate simplifications.
Current audio uses synthesized fallback tones; NASA audio recordings are not bundled.
The report renders the engine's mission comparisons, not sourced numerical fact cards.
External source pages and final scientific wording still need the science lead's verification.

## Fonts, libraries, tools

| What | Used for | Link | License |
| --- | --- | --- | --- |
| Phaser 3.90 | Field view rendering | https://github.com/phaserjs/phaser | MIT |
| Socket.IO | Networking | https://github.com/socketio/socket.io | MIT |
| React, Zustand, Vite, Vitest, Howler.js | UI, state, build, tests, audio | npm | MIT |
| VT323, Silkscreen (via Fontsource) | Pixel fonts | https://fontsource.org | OFL-1.1 |
| Share Tech Mono (font file in client/src/ui/fonts/, from Fontsource) | Menu screen font | https://fontsource.org/fonts/share-tech-mono | OFL-1.1 |

## Art

| What | Used for | Source | Notes |
| --- | --- | --- | --- |
| Crew class sprites (engineer, scout, geologist, biologist), `client/src/game/crewArt.ts` | Field view and the lobby specialty picker | Drawn pixel by pixel in code by Claude Code (24×24 frames, own walk cycle). Colours and silhouettes follow AI-generated reference sheets from the team; the reference images are not shipped | **AI-made.** Shown with the "AI-GENERATED ART" label. No logos, flags or mission patches |
| `assets/raw/tileset.png`, `assets/raw/base_reference.png` → `client/public/assets/interior/atlas.webp`, `tiles.webp` | Lander interior: props, floor and wall tiles, map layout | AI-generated tileset and reference picture supplied by the team; sliced without changes by `tools/art/slice_tileset.py` (Claude Code); hull wall fills generated to match the reference | **AI-generated.** Shown with the "AI-GENERATED ART" label. No logos, flags or mission patches. Image generator: _to be filled in by the team_ |
