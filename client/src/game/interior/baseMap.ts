// The lander interior map: data/base.tmj (Tiled JSON, built by tools/art/build_base_map.py from
// the team's tileset and base reference) plus the sprite atlas. Pure: no DOM, no Phaser.
// Coordinates are map pixels (64 px per tile, 1920x1088).
import tmjText from './data/base.tmj?raw';
import atlasJson from './data/atlas.json';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type ActionKind = 'sleep' | 'work' | 'tend' | 'talk' | 'exit';
export interface MapProp {
  id: string;
  /** Atlas frame name. */
  sprite: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Collision rectangle (the piece's base), or null to walk over or behind it. */
  foot: Rect | null;
  action: ActionKind | null;
  /** Decor/Overlay layer: drawn above the astronaut. */
  overlay: boolean;
  /** Hangs on a back wall (Decor/Overlay with mount=wall): always drawn behind the astronaut. */
  wall: boolean;
}
export interface MapDoor {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TmjProperty {
  name: string;
  value: string | number | boolean;
}
interface TmjObject {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TmjProperty[];
}
interface TmjLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup';
  data?: number[];
  objects?: TmjObject[];
}
interface Tmj {
  width: number;
  height: number;
  tilewidth: number;
  layers: TmjLayer[];
  tilesets: Array<{
    firstgid: number;
    columns: number;
    tiles: Array<{ id: number; properties: TmjProperty[] }>;
  }>;
}

const tmj = JSON.parse(tmjText) as Tmj;
export const ATLAS: Record<string, Frame> = (atlasJson as { frames: Record<string, Frame> }).frames;

export const TILE = tmj.tilewidth;
export const COLS = tmj.width;
export const ROWS = tmj.height;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;
export const TILESET = { firstgid: tmj.tilesets[0]!.firstgid, columns: tmj.tilesets[0]!.columns };

const layer = (name: string): TmjLayer => {
  const found = tmj.layers.find((l) => l.name === name);
  if (!found) throw new Error(`base.tmj: missing layer ${name}`);
  return found;
};
const prop = (o: TmjObject, key: string): string | undefined => {
  const v = o.properties?.find((p) => p.name === key)?.value;
  return v === undefined ? undefined : String(v);
};

export const FLOOR: readonly number[] = layer('Floor').data!;
export const WALLS: readonly number[] = layer('Walls').data!;

const collidingTiles = new Set(
  tmj.tilesets[0]!.tiles.filter((t) =>
    t.properties.some((p) => p.name === 'collides' && p.value === true),
  ).map((t) => t.id + tmj.tilesets[0]!.firstgid),
);

function toProp(o: TmjObject, overlay: boolean): MapProp {
  const fp = prop(o, 'footprint')?.split(',').map(Number);
  return {
    id: o.name,
    sprite: prop(o, 'sprite') ?? o.name,
    x: o.x,
    y: o.y,
    w: o.width,
    h: o.height,
    foot: fp
      ? {
          x0: o.x + fp[0]! * o.width,
          y0: o.y + fp[1]! * o.height,
          x1: o.x + fp[2]! * o.width,
          y1: o.y + fp[3]! * o.height,
        }
      : null,
    action: (prop(o, 'action') as ActionKind | undefined) ?? null,
    overlay: overlay && prop(o, 'mount') !== 'wall',
    wall: prop(o, 'mount') === 'wall',
  };
}

export const PROPS: readonly MapProp[] = [
  ...layer('Furniture/Props').objects!.map((o) => toProp(o, false)),
  ...layer('Decor/Overlay').objects!.map((o) => toProp(o, true)),
];
export const DOORS: readonly MapDoor[] = layer('Doors').objects!.map((o) => ({
  id: o.name,
  x: o.x,
  y: o.y,
  w: o.width,
  h: o.height,
}));
const markers = layer('Markers').objects!;
const spawn = markers.find((o) => o.name === 'spawn')!;
export const SPAWN = { x: spawn.x, y: spawn.y };
export const ROOMS: ReadonlyArray<{ id: string } & Rect> = markers
  .filter((o) => o.name !== 'spawn')
  .map((o) => ({ id: o.name, x0: o.x, y0: o.y, x1: o.x + o.width, y1: o.y + o.height }));

/** Collision grid: 8-px cells blocked by wall tiles or by a prop's base. */
export const CELL = 8;
const GW = MAP_W / CELL;
const GH = MAP_H / CELL;
const blocked = new Uint8Array(GW * GH);
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (!FLOOR[i] || collidingTiles.has(WALLS[i]!)) {
      const k = TILE / CELL;
      for (let y = 0; y < k; y++)
        for (let x = 0; x < k; x++) blocked[(r * k + y) * GW + c * k + x] = 1;
    }
  }
for (const p of PROPS) {
  if (!p.foot) continue;
  for (let y = Math.floor(p.foot.y0 / CELL); y < Math.ceil(p.foot.y1 / CELL); y++)
    for (let x = Math.floor(p.foot.x0 / CELL); x < Math.ceil(p.foot.x1 / CELL); x++)
      if (x >= 0 && y >= 0 && x < GW && y < GH) blocked[y * GW + x] = 1;
}

/** Feet hit-box half sizes, map px. */
const FOOT_W = 10;
const FOOT_H = 4;
/** How far (map px) from a prop's edge the E key still reaches it. */
export const REACH = 28;

function free(x: number, y: number): boolean {
  const cx = Math.floor(x / CELL),
    cy = Math.floor(y / CELL);
  return cx >= 0 && cy >= 0 && cx < GW && cy < GH && blocked[cy * GW + cx] === 0;
}

/** True if feet at (x, y) are on open floor (all four corners of the foot box). */
export function walkable(x: number, y: number): boolean {
  return (
    free(x - FOOT_W, y - FOOT_H) &&
    free(x + FOOT_W, y - FOOT_H) &&
    free(x - FOOT_W, y + FOOT_H) &&
    free(x + FOOT_W, y + FOOT_H)
  );
}

/** Move with wall sliding: try both axes, then each axis alone. */
export function step(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  if (walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  if (dx !== 0 && walkable(x + dx, y)) return { x: x + dx, y };
  if (dy !== 0 && walkable(x, y + dy)) return { x, y: y + dy };
  return { x, y };
}

/** Rectangle used for reach: the prop's base, or the whole sprite for props without one. */
export const reachRect = (p: MapProp): Rect =>
  p.foot ?? { x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h };

/** The usable prop closest to the feet, within REACH of its edge. */
export function nearestAction(x: number, y: number): MapProp | null {
  let best: MapProp | null = null,
    bestD = Infinity;
  for (const p of PROPS) {
    if (!p.action) continue;
    const r = reachRect(p);
    const d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
    if (d <= REACH && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

export function roomAt(x: number, y: number): string | null {
  return ROOMS.find((r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1)?.id ?? null;
}
