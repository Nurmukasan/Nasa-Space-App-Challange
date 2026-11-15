// Inside the lander, on top of interior_base.png (480x258, the team's reference picture).
// All coordinates are pixels of that picture. Pure data and geometry: no Phaser.
import { WALK, WALK_CELL } from './walkMask';

export const IMG_W = 480;
export const IMG_H = 258;

export type RoomId = 'lab' | 'bridge' | 'greenhouse' | 'quarters' | 'engine' | 'hall';
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const r = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });

export const ROOMS: Array<{ id: RoomId } & Rect> = [
  { id: 'bridge', ...r(188, 52, 292, 93) },
  { id: 'hall', ...r(170, 93, 312, 153) },
  { id: 'lab', ...r(15, 52, 172, 197) },
  { id: 'greenhouse', ...r(310, 52, 468, 203) },
  { id: 'quarters', ...r(17, 197, 172, 258) },
  { id: 'engine', ...r(187, 153, 293, 258) },
];

export type ActionKind = 'sleep' | 'work' | 'tend' | 'talk' | 'exit';

/** Something in the picture that answers the E key. */
export interface Spot extends Rect {
  id: string;
  action: ActionKind;
}
const s = (
  id: string,
  action: ActionKind,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Spot => ({
  id,
  action,
  ...r(x0, y0, x1, y1),
});

export const SPOTS: Spot[] = [
  s('aria', 'talk', 86, 52, 119, 90),
  s('lab_computers', 'work', 33, 62, 82, 92),
  s('lab_rocks', 'work', 68, 100, 101, 118),
  s('lab_jars', 'work', 103, 100, 135, 118),
  s('lab_scope_l', 'work', 15, 160, 50, 195),
  s('lab_scope_r', 'work', 102, 168, 170, 195),
  s('bridge_console', 'work', 190, 52, 290, 63),
  s('engine_panel', 'work', 258, 165, 293, 185),
  s('engine_tools', 'work', 188, 190, 222, 245),
  s('core', 'work', 225, 198, 256, 250),
  s('arcade', 'work', 146, 216, 172, 248),
  s('gh_planters', 'tend', 312, 75, 362, 92),
  s('gh_beds', 'tend', 360, 100, 380, 165),
  s('gh_beds_e', 'tend', 395, 100, 467, 157),
  s('gh_planter_s', 'tend', 413, 172, 465, 197),
  s('gh_tank', 'work', 313, 170, 342, 197),
  s('sofa', 'sleep', 120, 228, 152, 248),
  s('armchair', 'sleep', 105, 232, 118, 257),
  // The hall terminal west of the bridge door runs the airlock.
  s('airlock', 'exit', 173, 97, 220, 127),
];

/** Where the astronaut appears after cycling the airlock (feet). */
export const SPAWN = { x: 196, y: 138 };
/** Where a sleeper lies on each bed-like spot. */
export const BEDS: Record<string, { x: number; y: number }> = {
  sofa: { x: 136, y: 244 },
  armchair: { x: 112, y: 250 },
};

/** Sliding doors: the closed leaves are frames of interior_doors.png drawn at (x, y). */
export interface Door {
  id: string;
  frame: number;
  x: number;
  y: number;
}
export const DOOR_W = 35;
export const DOOR_H = 30;
export const DOORS: Door[] = [
  { id: 'bridge', frame: 0, x: 223, y: 93 },
  { id: 'engine', frame: 1, x: 223, y: 153 },
  { id: 'quarters', frame: 2, x: 68, y: 206 },
];

/** Feet hit-box half sizes, px. */
const FOOT_W = 4;
const FOOT_H = 2;
/** How far (px) from a spot's edge the E key still reaches it. */
export const REACH = 10;
/** Doors open when the feet are this close (px) to the door centre. */
export const DOOR_RANGE = 34;

function floorAt(x: number, y: number): boolean {
  const row = WALK[Math.floor(y / WALK_CELL)];
  return row?.[Math.floor(x / WALK_CELL)] === '.';
}

/** True if feet at (x, y) stand on floor (all four corners of the foot box). */
export function walkable(x: number, y: number): boolean {
  return (
    floorAt(x - FOOT_W, y - FOOT_H) &&
    floorAt(x + FOOT_W, y - FOOT_H) &&
    floorAt(x - FOOT_W, y + FOOT_H) &&
    floorAt(x + FOOT_W, y + FOOT_H)
  );
}

/** Move with wall sliding: try both axes, then each axis alone. */
export function step(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  if (walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  if (dx !== 0 && walkable(x + dx, y)) return { x: x + dx, y };
  if (dy !== 0 && walkable(x, y + dy)) return { x, y: y + dy };
  return { x, y };
}

/** The usable spot closest to the feet, within REACH of its edge. */
export function nearestAction(x: number, y: number): Spot | null {
  let best: Spot | null = null,
    bestD = Infinity;
  for (const sp of SPOTS) {
    const d = Math.hypot(Math.max(sp.x0 - x, 0, x - sp.x1), Math.max(sp.y0 - y, 0, y - sp.y1));
    if (d <= REACH && d < bestD) {
      best = sp;
      bestD = d;
    }
  }
  return best;
}

export function roomAt(x: number, y: number): RoomId | null {
  return ROOMS.find((rm) => x >= rm.x0 && x < rm.x1 && y >= rm.y0 && y < rm.y1)?.id ?? null;
}
