// Static picture of the lander interior (floors, walls, furniture), painted once into a canvas.
// Animated parts (doors, AI screen, core glow, alarm lights) are separate objects in the scene.
import { COLS, PROPS, ROOMS, ROWS, TILE, cellAt } from './layout';
import type { Prop, RoomId } from './layout';

const C = {
  hull: '#0d0f16',
  wall: '#3a4150',
  wallTop: '#5a6476',
  wallEdge: '#1c2029',
  stripeA: '#f2c230',
  stripeB: '#1c2029',
  outline: '#12141c',
  metal: '#7c8696',
  metalDark: '#4e5664',
  screen: '#0e2a30',
  screenGlow: '#2fd6d0',
  wood: '#8a5a34',
  woodDark: '#5e3a20',
  soil: '#5a3a24',
  leaf: '#4e9e3c',
  leafHi: '#a6e070',
  water: '#3a8ad0',
  waterHi: '#9ad0f6',
  green: '#3ec44e',
  greenHi: '#b6f0a0',
  cloth: '#c8642a',
  clothHi: '#e8a050',
  sheet: '#d8dce6',
  red: '#d03030',
};

/** Floor colour per room, so each room reads at a glance. */
const FLOOR: Record<RoomId, [string, string]> = {
  lab: ['#5c6470', '#525a66'],
  bridge: ['#4a5262', '#424a58'],
  greenhouse: ['#566052', '#4c5648'],
  quarters: ['#6a5e56', '#60544c'],
  engine: ['#4e5258', '#45494f'],
  airlock: ['#585c64', '#4e525a'],
  hall: ['#60666e', '#585e66'],
};

type Ctx = CanvasRenderingContext2D;
const box = (g: Ctx, x: number, y: number, w: number, h: number, c: string): void => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
/** Filled box with a dark 1-px outline and a light top edge: the basic furniture block. */
const block = (
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
  top: string,
): void => {
  box(g, x, y, w, h, C.outline);
  box(g, x + 1, y + 1, w - 2, h - 2, c);
  box(g, x + 1, y + 1, w - 2, 2, top);
};

function floors(g: Ctx): void {
  box(g, 0, 0, COLS * TILE, ROWS * TILE, C.hull);
  for (const room of ROOMS) {
    const [a, b] = FLOOR[room.id];
    for (let r = 0; r < room.h; r++)
      for (let c = 0; c < room.w; c++) {
        const x = (room.col + c) * TILE,
          y = (room.row + r) * TILE;
        box(g, x, y, TILE, TILE, (c + r) % 2 ? a : b);
        box(g, x, y, TILE, 1, C.wallEdge); // plate seams
        box(g, x, y, 1, TILE, C.wallEdge);
        box(g, x + 2, y + 2, 1, 1, C.metal); // rivets
        box(g, x + TILE - 3, y + TILE - 3, 1, 1, C.metal);
      }
  }
  // Door thresholds use the hall floor.
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (cellAt(c, r) === 'D') box(g, c * TILE, r * TILE, TILE, TILE, FLOOR.hall[0]);
}

function walls(g: Ctx): void {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (cellAt(c, r) !== '#') continue;
      const x = c * TILE,
        y = r * TILE;
      box(g, x, y, TILE, TILE, C.wall);
      // A lit top face where the wall meets floor below it: gives the walls some height.
      const below = cellAt(c, r + 1);
      if (below === '.' || below === 'D') {
        box(g, x, y + TILE - 5, TILE, 5, C.wallTop);
        box(g, x, y + TILE - 1, TILE, 1, C.outline);
      }
      if (cellAt(c, r - 1) === '.') box(g, x, y, TILE, 1, C.outline);
    }
  // Hazard stripes over every doorway.
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (cellAt(c, r) === 'D' && cellAt(c - 1, r) === '#')
        for (let i = 0; i < 6; i++)
          box(g, c * TILE - 4 + i * 6.5, r * TILE - 3, 3, 3, i % 2 ? C.stripeA : C.stripeB);
}

function screen(g: Ctx, x: number, y: number, w: number, h: number): void {
  box(g, x, y, w, h, C.outline);
  box(g, x + 1, y + 1, w - 2, h - 2, C.screen);
  box(g, x + 2, y + 2, Math.max(1, w - 6), 1, C.screenGlow);
  box(g, x + 2, y + 4, Math.max(1, w - 8), 1, '#1c7a80');
}

function prop(g: Ctx, pr: Prop): void {
  const x = pr.col * TILE,
    y = pr.row * TILE,
    w = pr.w * TILE,
    h = pr.h * TILE;
  switch (pr.kind) {
    case 'desk':
    case 'console':
      block(g, x, y + 4, w, h - 4, C.metalDark, C.metal);
      for (let i = 0; i < pr.w; i++) screen(g, x + i * TILE + 2, y - 4, TILE - 4, 9);
      break;
    case 'bench':
      block(g, x, y + 4, w, h - 4, C.metal, C.sheet);
      ['#7a6a4a', '#a84a2e', '#c6643a', '#6c8a4a'].forEach((c, i) =>
        box(g, x + 4 + i * 10, y + 2, 5, 4, c),
      );
      break;
    case 'microscope':
      block(g, x + 2, y + 6, 12, 9, C.metal, C.sheet);
      box(g, x + 7, y - 2, 3, 9, C.metalDark);
      box(g, x + 5, y - 3, 7, 2, C.outline);
      break;
    case 'tank':
      block(g, x + 1, y - 6, 14, 21, C.green, C.greenHi);
      box(g, x + 3, y - 3, 2, 14, C.greenHi);
      box(g, x + 1, y - 8, 14, 3, C.metal);
      break;
    case 'chair':
      block(g, x + 3, y + 3, 10, 9, '#2c3444', '#4a5468');
      break;
    case 'planter':
      block(g, x, y + 6, w, h - 6, C.wood, C.woodDark);
      box(g, x + 2, y + 7, w - 4, 3, C.soil);
      for (let i = 0; i < pr.w * 2; i++) {
        const px = x + 3 + i * 7;
        box(g, px, y - 2 + (i % 2) * 2, 4, 8, C.leaf);
        box(g, px + 1, y - 3 + (i % 2) * 2, 2, 3, C.leafHi);
        if (i % 3 === 1) box(g, px + 1, y - 5, 3, 3, '#e05a5a');
      }
      break;
    case 'water':
      block(g, x + 1, y - 4, 14, h + 4, C.water, C.waterHi);
      box(g, x + 4, y, 2, h - 6, C.waterHi);
      break;
    case 'bed':
      block(g, x, y, w, h, C.metalDark, C.metal);
      box(g, x + 2, y + 2, w - 4, h - 4, '#2e5a8a');
      box(g, x + w - 9, y + 2, 7, h - 4, C.sheet); // pillow at the head end
      break;
    case 'galley':
      block(g, x, y + 3, w, h - 3, C.metal, C.sheet);
      box(g, x + 4, y + 6, 8, 4, C.outline);
      box(g, x + 20, y + 5, 6, 5, '#6a7a8a');
      break;
    case 'sofa':
      block(g, x, y, w, h, C.cloth, C.clothHi);
      box(g, x + 2, y + 9, w - 4, 3, C.outline);
      break;
    case 'core':
      block(g, x - 2, y - 6, w + 4, h + 6, C.metalDark, C.metal);
      box(g, x + 6, y - 2, w - 12, h - 4, C.outline);
      break;
    case 'tools':
      block(g, x, y - 2, w, h + 2, '#2c3444', '#4a5468');
      box(g, x + 4, y + 1, 2, 9, C.metal);
      box(g, x + 10, y + 2, 6, 2, C.metal);
      box(g, x + 20, y + 1, 3, 8, C.red);
      break;
    case 'pipes':
      box(g, x, y + 2, w, 3, C.red);
      box(g, x, y + 8, w, 3, '#3a6ab0');
      box(g, x + 6, y, 4, 13, C.metalDark);
      break;
    case 'suits':
      for (let i = 0; i < pr.w; i++) {
        block(g, x + i * TILE + 2, y - 2, 12, 16, C.sheet, '#ffffff');
        box(g, x + i * TILE + 5, y + 1, 6, 4, '#c4b99e');
      }
      break;
    case 'ai':
    case 'hatch':
      break; // drawn by the scene: animated
    default:
      block(g, x, y, w, h, C.metal, C.sheet);
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
  for (const pr of [...PROPS].sort((a, b) => a.row - b.row)) prop(g, pr);
  return canvas;
}
