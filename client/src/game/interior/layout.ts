// Inside the lander: one screen (30 x 17 tiles of 16 px), drawn without scrolling.
// Pure data and geometry, no Phaser: the scene, the art and the tests all read this file.

export const TILE = 16;
export const COLS = 30;
export const ROWS = 17;

/** '#' wall, '.' floor, 'D' sliding door (2 tiles wide, opens when someone is near). */
const MAP = [
  '##############################',
  '#........#..........#........#',
  '#........#..........#........#',
  '#........#..........#........#',
  '#........#..........#........#',
  '#........#..........#........#',
  '####DD########DD########DD####',
  '#............................#',
  '#............................#',
  '#............................#',
  '####DD########DD########DD####',
  '#........#..........#........#',
  '#........#..........#........#',
  '#........#..........#........#',
  '#........#..........#........#',
  '#........#..........#........#',
  '##########################DD##',
];

export type RoomId = 'lab' | 'bridge' | 'greenhouse' | 'quarters' | 'engine' | 'airlock' | 'hall';
export const ROOMS: Array<{ id: RoomId; col: number; row: number; w: number; h: number }> = [
  { id: 'lab', col: 1, row: 1, w: 8, h: 5 },
  { id: 'bridge', col: 10, row: 1, w: 10, h: 5 },
  { id: 'greenhouse', col: 21, row: 1, w: 8, h: 5 },
  { id: 'hall', col: 1, row: 7, w: 28, h: 3 },
  { id: 'quarters', col: 1, row: 11, w: 8, h: 5 },
  { id: 'engine', col: 10, row: 11, w: 10, h: 5 },
  { id: 'airlock', col: 21, row: 11, w: 8, h: 5 },
];

export type ActionKind = 'sleep' | 'work' | 'tend' | 'talk' | 'exit';

/** Furniture in tile units. Solid pieces block walking; `action` pieces answer the E key. */
export interface Prop {
  id: string;
  kind: string;
  col: number;
  row: number;
  w: number;
  h: number;
  solid: boolean;
  action?: ActionKind;
}

const p = (
  id: string,
  kind: string,
  col: number,
  row: number,
  w: number,
  h: number,
  action?: ActionKind,
  solid = true,
): Prop => ({ id, kind, col, row, w, h, solid, action });

export const PROPS: Prop[] = [
  // Lab: computers, sample bench, microscope, two culture tanks.
  p('lab_desk', 'desk', 1, 1, 3, 1, 'work'),
  p('lab_bench', 'bench', 5, 1, 3, 1, 'work'),
  p('lab_tank_a', 'tank', 2, 4, 1, 1),
  p('lab_tank_b', 'tank', 4, 4, 1, 1),
  p('lab_scope', 'microscope', 7, 4, 1, 1, 'work'),
  // Bridge: the AI assistant screen on the north wall, two consoles, chairs.
  p('ai_screen', 'ai', 13, 1, 4, 2, 'talk'),
  p('console_l', 'console', 10, 1, 2, 1, 'work'),
  p('console_r', 'console', 18, 1, 2, 1, 'work'),
  p('chair_l', 'chair', 11, 3, 1, 1, undefined, false),
  p('chair_r', 'chair', 18, 3, 1, 1, undefined, false),
  // Greenhouse: planters and water tanks.
  p('planter_a', 'planter', 21, 1, 3, 1, 'tend'),
  p('planter_b', 'planter', 25, 1, 3, 1, 'tend'),
  p('planter_c', 'planter', 22, 4, 2, 1, 'tend'),
  p('water', 'water', 27, 3, 1, 2),
  // Quarters: two bunks, a table, a sofa.
  p('bunk_a', 'bed', 1, 11, 2, 1, 'sleep'),
  p('bunk_b', 'bed', 1, 13, 2, 1, 'sleep'),
  p('galley', 'galley', 6, 11, 3, 1),
  p('sofa', 'sofa', 5, 15, 3, 1, undefined, false),
  // Engine room: power core and a tool wall.
  p('core', 'core', 14, 12, 2, 2, 'work'),
  p('toolwall', 'tools', 10, 11, 2, 1, 'work'),
  p('pipes', 'pipes', 18, 11, 2, 1),
  // Airlock: suit rack and the outer hatch (doorway in the south wall).
  p('suits', 'suits', 21, 11, 3, 1),
  p('hatch', 'hatch', 26, 15, 2, 1, 'exit', false),
];

/** Where the astronaut appears after cycling the airlock (pixel coordinates, feet). */
export const SPAWN = { x: 27 * TILE, y: 14 * TILE };
/** Feet hit-box half sizes, px. */
const FOOT_W = 4;
const FOOT_H = 3;
/** How far (px) from a prop's edge the E key still reaches it. */
export const REACH = 10;
/** Doors open when an astronaut's feet are this close (px) to the door centre. */
export const DOOR_RANGE = 30;

export interface Door {
  col: number;
  row: number;
  /** Pixel centre of the 2-tile doorway. */
  x: number;
  y: number;
  /** The hatch to the surface stays shut until the astronaut uses it. */
  outer: boolean;
}

export const DOORS: Door[] = [];
MAP.forEach((line, row) => {
  for (let col = 0; col < COLS; col++)
    if (line[col] === 'D' && line[col - 1] !== 'D')
      DOORS.push({
        col,
        row,
        x: (col + 1) * TILE,
        y: row * TILE + TILE / 2,
        outer: row === ROWS - 1,
      });
});

export function cellAt(col: number, row: number): string {
  return MAP[row]?.[col] ?? '#';
}

function solidAt(x: number, y: number): boolean {
  const col = Math.floor(x / TILE),
    row = Math.floor(y / TILE);
  const c = cellAt(col, row);
  if (c === '#') return true;
  if (c === 'D') return row === ROWS - 1; // the outer hatch is never walked through
  return PROPS.some(
    (pr) =>
      pr.solid && col >= pr.col && col < pr.col + pr.w && row >= pr.row && row < pr.row + pr.h,
  );
}

/** True if feet at (x, y) do not overlap a wall or solid furniture. */
export function walkable(x: number, y: number): boolean {
  return (
    !solidAt(x - FOOT_W, y - FOOT_H) &&
    !solidAt(x + FOOT_W, y - FOOT_H) &&
    !solidAt(x - FOOT_W, y + FOOT_H) &&
    !solidAt(x + FOOT_W, y + FOOT_H)
  );
}

/** Move with wall sliding: try both axes, then each axis alone. */
export function step(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  if (walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  if (dx !== 0 && walkable(x + dx, y)) return { x: x + dx, y };
  if (dy !== 0 && walkable(x, y + dy)) return { x, y: y + dy };
  return { x, y };
}

/** The usable prop closest to the feet, within REACH of its edge. */
export function nearestAction(x: number, y: number): Prop | null {
  let best: Prop | null = null,
    bestD = Infinity;
  for (const pr of PROPS) {
    if (!pr.action) continue;
    const left = pr.col * TILE,
      top = pr.row * TILE;
    const dx = Math.max(left - x, 0, x - (left + pr.w * TILE));
    const dy = Math.max(top - y, 0, y - (top + pr.h * TILE));
    const d = Math.hypot(dx, dy);
    if (d <= REACH && d < bestD) {
      best = pr;
      bestD = d;
    }
  }
  return best;
}

export function roomAt(x: number, y: number): RoomId | null {
  const col = Math.floor(x / TILE),
    row = Math.floor(y / TILE);
  return (
    ROOMS.find((r) => col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h)?.id ??
    null
  );
}
