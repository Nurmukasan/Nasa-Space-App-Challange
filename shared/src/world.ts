// Big-world geography (docs/product-logic.md 7.1, 7.24): biomes around the landing plains and
// lava tubes whose rock rims block movement. Pure functions of the landing site's terrain salt:
// the server applies the rules, the client paints the very same world. Never sent over the wire.
import { LANDER_POS, ROVER, WORLD, WORLD_MAX, WORLD_MIN } from './balance';
import { SITES } from './catalog';
import { createRng } from './rng';
import type { BiomeId, Vec2 } from './types';

const TAU = Math.PI * 2;

export interface Tube {
  id: string;
  /** Centreline of the tube floor. */
  points: Vec2[];
  halfWidth: number;
  /** Skylights: gaps in the rock rim where the crew can walk in. */
  entrances: Vec2[];
  /** Bounds of everything the tube touches (floor, rim, skylights). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface WorldDef {
  salt: number;
  /** Rotation of the outer sectors, radians. */
  rotation: number;
  /** Outer biomes by angle after rotation, in [0, 2π). */
  sectors: Array<{ biome: Exclude<BiomeId, 'plains'>; from: number; to: number }>;
  tubes: Tube[];
}

export const OUTER_BIOMES: Array<Exclude<BiomeId, 'plains'>> = ['delta', 'dunes', 'ice', 'lava'];
const defs = new Map<number, WorldDef>();

function mixFor(salt: number): { delta: number; crater: number; basalt: number } {
  const site = Object.values(SITES).find((s) => s.terrainSalt === salt);
  return site ? site.mix : { delta: 1, crater: 1, basalt: 1 };
}

/** Wavy edge of the landing plains, px from the lander. */
function plainsEdge(salt: number, x: number, y: number, angle: number): number {
  return (
    WORLD.plainsR *
      (1 + 0.1 * Math.sin(3 * angle + salt) + 0.05 * Math.sin(7 * angle - 1.3 * salt)) +
    30 * Math.sin(x / 47 + salt) * Math.cos(y / 53 - salt)
  );
}

/** Biome from the layout alone (tubes are not consulted). */
function biomeOf(def: WorldDef, x: number, y: number): BiomeId {
  const dx = x - LANDER_POS.x,
    dy = y - LANDER_POS.y;
  const d = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  if (d < plainsEdge(def.salt, x, y, angle)) return 'plains';
  // Warp the sector borders so they meander instead of running straight out.
  let a =
    angle -
    def.rotation +
    0.3 * Math.sin(d / 650 + def.salt) +
    0.05 * Math.sin(x / 71 - y / 89 + def.salt);
  a = ((a % TAU) + TAU) % TAU;
  for (const s of def.sectors) if (a < s.to) return s.biome;
  return def.sectors[def.sectors.length - 1]!.biome;
}

function inBounds(p: Vec2): boolean {
  return (
    p.x > WORLD_MIN + WORLD.edgeMargin &&
    p.x < WORLD_MAX - WORLD.edgeMargin &&
    p.y > WORLD_MIN + WORLD.edgeMargin &&
    p.y < WORLD_MAX - WORLD.edgeMargin
  );
}

function buildTubes(def: WorldDef): Tube[] {
  const lava = def.sectors.find((s) => s.biome === 'lava')!;
  const rng = createRng((Math.imul(def.salt, 0x9e3779b1) ^ 0x7ab3) >>> 0);
  const tubes: Tube[] = [];
  const clear = (p: Vec2, halfWidth: number) =>
    tubes.every((t) =>
      t.points.every(
        (q) =>
          Math.hypot(p.x - q.x, p.y - q.y) >
          halfWidth + t.halfWidth + 2 * WORLD.rimPx + 2 * WORLD.entranceR,
      ),
    );
  for (let attempt = 0; tubes.length < WORLD.tubeCount && attempt < WORLD.tubeAttempts; attempt++) {
    const angle = def.rotation + lava.from + (lava.to - lava.from) * rng.range(0.15, 0.85);
    const r = rng.range(WORLD.tubeMinDist, WORLD.tubeMaxDist);
    let heading = angle + ((rng.next() < 0.5 ? 1 : -1) * Math.PI) / 2 + rng.range(-0.5, 0.5);
    const halfWidth = Math.round(rng.range(WORLD.tubeHalfWidthMin, WORLD.tubeHalfWidthMax));
    let p: Vec2 = { x: LANDER_POS.x + Math.cos(angle) * r, y: LANDER_POS.y + Math.sin(angle) * r };
    const points: Vec2[] = [];
    for (let k = 0; k <= WORLD.tubeSegments; k++) {
      if (!inBounds(p) || biomeOf(def, p.x, p.y) !== 'lava' || !clear(p, halfWidth)) break;
      points.push({ x: Math.round(p.x), y: Math.round(p.y) });
      heading += rng.range(-WORLD.tubeTurn, WORLD.tubeTurn);
      p = {
        x: p.x + Math.cos(heading) * WORLD.tubeSegLen,
        y: p.y + Math.sin(heading) * WORLD.tubeSegLen,
      };
    }
    if (points.length < WORLD.tubeMinPoints) continue;
    const entrances: Vec2[] = [];
    [0.3, 0.7].forEach((at, i) => {
      const k = Math.floor((points.length - 1) * at);
      const a = points[k]!,
        b = points[k + 1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const side = i === 0 ? 1 : -1;
      const off = halfWidth + WORLD.rimPx / 2;
      entrances.push({
        x: Math.round(a.x + (-(b.y - a.y) / len) * off * side),
        y: Math.round(a.y + ((b.x - a.x) / len) * off * side),
      });
    });
    const reach = halfWidth + WORLD.rimPx + WORLD.entranceR + ROVER.tubeClearance;
    tubes.push({
      id: `T${tubes.length + 1}`,
      points,
      halfWidth,
      entrances,
      x0: Math.min(...points.map((q) => q.x)) - reach,
      y0: Math.min(...points.map((q) => q.y)) - reach,
      x1: Math.max(...points.map((q) => q.x)) + reach,
      y1: Math.max(...points.map((q) => q.y)) + reach,
    });
  }
  return tubes;
}

/** Geography of one landing site, built once and cached. */
export function worldFor(salt: number): WorldDef {
  const known = defs.get(salt);
  if (known) return known;
  const mix = mixFor(salt);
  const weights: Record<Exclude<BiomeId, 'plains'>, number> = {
    delta: mix.delta + 1,
    dunes: WORLD.duneWeight,
    ice: mix.crater + 1,
    lava: mix.basalt + 1,
  };
  const total = OUTER_BIOMES.reduce((sum, b) => sum + weights[b], 0);
  let from = 0;
  const sectors = OUTER_BIOMES.map((biome) => {
    const to = from + (weights[biome] / total) * TAU;
    const s = { biome, from, to };
    from = to;
    return s;
  });
  const def: WorldDef = { salt, rotation: (salt * 2.399963) % TAU, sectors, tubes: [] };
  def.tubes = buildTubes(def);
  defs.set(salt, def);
  return def;
}

export function biomeAt(x: number, y: number, salt: number): BiomeId {
  return biomeOf(worldFor(salt), x, y);
}

function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance from a point to a tube's centreline. */
export function tubeDistance(tube: Tube, x: number, y: number): number {
  let best = Infinity;
  const p = tube.points;
  for (let i = 0; i + 1 < p.length; i++) {
    const d = segmentDistance(x, y, p[i]!.x, p[i]!.y, p[i + 1]!.x, p[i + 1]!.y);
    if (d < best) best = d;
  }
  return best;
}

/** The tube whose bounds contain the point, with the distance to its centreline. */
export function tubeAt(x: number, y: number, salt: number): { tube: Tube; d: number } | null {
  for (const tube of worldFor(salt).tubes) {
    if (x < tube.x0 || x > tube.x1 || y < tube.y0 || y > tube.y1) continue;
    return { tube, d: tubeDistance(tube, x, y) };
  }
  return null;
}

/** 0 open ground · 1 tube floor · 2 rock rim (wall) · 3 skylight (open rim). */
export function caveCellAt(x: number, y: number, salt: number): 0 | 1 | 2 | 3 {
  const near = tubeAt(x, y, salt);
  if (!near) return 0;
  const { tube, d } = near;
  if (d < tube.halfWidth) return 1;
  if (d >= tube.halfWidth + WORLD.rimPx) return 0;
  return tube.entrances.some((e) => Math.hypot(x - e.x, y - e.y) < WORLD.entranceR) ? 3 : 2;
}

/** Inside a lava tube: rock overhead (shelter, darkness, no radio). */
export function inCave(x: number, y: number, salt: number): boolean {
  return caveCellAt(x, y, salt) === 1;
}

/** Solid rock rim of a lava tube. */
export function wallAt(x: number, y: number, salt: number): boolean {
  return caveCellAt(x, y, salt) === 2;
}

/** Rovers stay out of tubes: the floor, the rim and the skylights are all too tight. */
export function roverBlockedAt(x: number, y: number, salt: number): boolean {
  const near = tubeAt(x, y, salt);
  return !!near && near.d < near.tube.halfWidth + WORLD.rimPx + ROVER.tubeClearance;
}

/** True if a straight step crosses a wall. Starting inside a wall never traps anyone. */
export function moveBlocked(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  salt: number,
  rover = false,
): boolean {
  const blocked = rover ? roverBlockedAt : wallAt;
  if (blocked(ax, ay, salt)) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / WORLD.sampleStep));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (blocked(ax + (bx - ax) * t, ay + (by - ay) * t, salt)) return true;
  }
  return false;
}

/**
 * Where a step from a to b ends against the walls: straight if clear, otherwise sliding along one
 * axis, otherwise no move. Client prediction, the server check and the bots share this function.
 */
export function slideMove(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  salt: number,
  rover = false,
): Vec2 {
  if (!moveBlocked(ax, ay, bx, by, salt, rover)) return { x: bx, y: by };
  if (!moveBlocked(ax, ay, bx, ay, salt, rover)) return { x: bx, y: ay };
  if (!moveBlocked(ax, ay, ax, by, salt, rover)) return { x: ax, y: by };
  return { x: ax, y: ay };
}
