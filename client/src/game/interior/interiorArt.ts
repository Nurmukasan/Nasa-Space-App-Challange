// Static picture of the lander interior (floors, walls, furniture), painted once into a canvas.
// Look follows the team's reference: light grey floor plates, thick dark walls with a lit top,
// hazard stripes over doors. Outside the hull stays transparent, so the Mars surface shows.
// Animated parts (doors, ARIA screen, core glow, alarm) are separate objects in the scene.
import { COLS, PROPS, ROOMS, ROWS, TILE, cellAt } from './layout';
import type { RoomId } from './layout';
import { drawProp } from './furniture';
import { P, box } from './paint';

/** Floor plate colours per room: [plate, alternate plate]. */
const FLOOR: Record<RoomId, [string, string]> = {
  lab: ['#6b727d', '#666d78'],
  bridge: ['#5d6573', '#59616e'],
  hall: ['#6e7580', '#69707b'],
  greenhouse: ['#6a7480', '#65707b'],
  quarters: ['#6b6f78', '#666a73'],
  engine: ['#5a6270', '#555d6a'],
  airlock: ['#666c76', '#616771'],
};

type Ctx = CanvasRenderingContext2D;

function plate(g: Ctx, x: number, y: number, c: string): void {
  box(g, x, y, TILE, TILE, c);
  box(g, x, y, TILE, 1, P.seamLight);
  box(g, x, y, 1, TILE, P.seamLight);
  box(g, x, y + TILE - 1, TILE, 1, P.seam);
  box(g, x + TILE - 1, y, 1, TILE, P.seam);
}

function floors(g: Ctx): void {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cell = cellAt(c, r);
      if (cell !== '.' && cell !== 'D') continue;
      const room = ROOMS.find(
        (rm) => c >= rm.col && c < rm.col + rm.w && r >= rm.row && r < rm.row + rm.h,
      );
      const [a, b] = FLOOR[room?.id ?? 'hall'];
      plate(g, c * TILE, r * TILE, (c + r) % 2 ? a : b);
    }
}

function walls(g: Ctx): void {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (cellAt(c, r) !== '#') continue;
      const x = c * TILE,
        y = r * TILE;
      box(g, x, y, TILE, TILE, P.wall);
      const below = cellAt(c, r + 1);
      const above = cellAt(c, r - 1);
      // The hull's outer edge is a black rim with a thin grey bevel.
      if (above === ' ' || r === 0) box(g, x, y, TILE, 2, P.rim);
      if (cellAt(c - 1, r) === ' ' || c === 0) box(g, x, y, 2, TILE, P.rim);
      if (cellAt(c + 1, r) === ' ' || c === COLS - 1) box(g, x + TILE - 2, y, 2, TILE, P.rim);
      if (below === ' ' || r === ROWS - 1) box(g, x, y + TILE - 2, TILE, 2, P.rim);
      // Lit top face where a wall meets the floor below: gives the walls height.
      if (below === '.' || below === 'D') {
        box(g, x, y + TILE - 6, TILE, 5, P.wallTop);
        box(g, x, y + TILE - 6, TILE, 1, P.wallHi);
        box(g, x, y + TILE - 1, TILE, 1, P.rim);
      }
      // Side faces against floor to the left/right.
      if (cellAt(c + 1, r) === '.') box(g, x + TILE - 2, y, 2, TILE, P.wallTop);
      if (cellAt(c - 1, r) === '.') box(g, x, y, 2, TILE, P.wallTop);
    }
  // Hazard stripes over every doorway, like the reference.
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (cellAt(c, r) === 'D' && cellAt(c - 1, r) === '#') {
        const x = c * TILE - 4,
          y = r * TILE - 5;
        box(g, x, y, 40, 5, P.rim);
        for (let i = 0; i < 8; i++) box(g, x + 1 + i * 5, y + 1, 3, 3, i % 2 ? P.stripe : P.rim);
      }
}

/** Paints the whole interior into a new canvas (COLS*TILE x ROWS*TILE). */
export function paintInterior(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  floors(g);
  walls(g);
  for (const pr of [...PROPS].sort((a, b) => a.row + a.h - (b.row + b.h))) drawProp(g, pr);
  return canvas;
}
