// Big world (v2.1): biomes, lava tubes, walls, big-world sites and caches.
import { expect, it } from 'vitest';
import {
  BIG_SITES,
  CACHES,
  LANDER_POS,
  PRESETS,
  SITES,
  WORLD,
  WORLD_MAX,
  WORLD_MIN,
  WORLD_PX,
  biomeAt,
  caveCellAt,
  clampToWorld,
  deriveParams,
  generateCaches,
  generateSites,
  inCave,
  moveBlocked,
  roverBlockedAt,
  slideMove,
  tubeDistance,
  wallAt,
  worldFor,
} from '../src';
import type { BiomeId, Tube } from '../src';

const SALTS = Object.values(SITES).map((s) => s.terrainSalt);

it('the world is ~13x larger and centred on the lander', () => {
  expect((WORLD_PX / 1536) ** 2).toBeGreaterThan(10);
  expect(WORLD_MIN + WORLD_PX / 2).toBe(LANDER_POS.x);
  expect(clampToWorld(-1e6)).toBe(WORLD_MIN + 8);
  expect(clampToWorld(1e6)).toBe(WORLD_MAX - 8);
});

it('every landing site has plains around the lander and all four outer biomes', () => {
  for (const salt of SALTS) {
    for (let r = 0; r <= 900; r += 150)
      for (let a = 0; a < 360; a += 30) {
        const x = LANDER_POS.x + Math.cos((a * Math.PI) / 180) * r;
        const y = LANDER_POS.y + Math.sin((a * Math.PI) / 180) * r;
        expect(biomeAt(x, y, salt)).toBe('plains');
      }
    const seen = new Set<BiomeId>();
    for (let a = 0; a < 360; a += 2)
      seen.add(
        biomeAt(
          LANDER_POS.x + Math.cos((a * Math.PI) / 180) * 2000,
          LANDER_POS.y + Math.sin((a * Math.PI) / 180) * 2000,
          salt,
        ),
      );
    expect([...seen].sort()).toEqual(['delta', 'dunes', 'ice', 'lava']);
  }
});

it('the landing site shapes the geography: Jezero is mostly delta, Elysium mostly lava', () => {
  const share = (salt: number, biome: BiomeId) => {
    let n = 0;
    for (let a = 0; a < 360; a++)
      if (
        biomeAt(
          LANDER_POS.x + Math.cos((a * Math.PI) / 180) * 2200,
          LANDER_POS.y + Math.sin((a * Math.PI) / 180) * 2200,
          salt,
        ) === biome
      )
        n++;
    return n;
  };
  expect(share(SITES.jezero.terrainSalt, 'delta')).toBeGreaterThan(
    share(SITES.jezero.terrainSalt, 'ice'),
  );
  expect(share(SITES.elysium.terrainSalt, 'lava')).toBeGreaterThan(
    share(SITES.elysium.terrainSalt, 'delta'),
  );
});

/** A centreline point of `tube` far from both skylights, with the outward normal there. */
function solidSide(tube: Tube) {
  for (let i = 1; i + 1 < tube.points.length; i++) {
    const a = tube.points[i]!,
      b = tube.points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    const far = (s: number) =>
      tube.entrances.every(
        (e) => Math.hypot(a.x + n.x * s * 50 - e.x, a.y + n.y * s * 50 - e.y) > WORLD.entranceR * 3,
      );
    if (far(1)) return { c: a, n };
    if (far(-1)) return { c: a, n: { x: -n.x, y: -n.y } };
  }
  throw new Error('no solid stretch');
}

it('lava tubes: floor inside, a solid rim, two skylights; all in the lava flows', () => {
  for (const salt of SALTS) {
    const { tubes } = worldFor(salt);
    expect(tubes.length).toBeGreaterThanOrEqual(2);
    for (const tube of tubes) {
      expect(tube.entrances).toHaveLength(2);
      for (const p of tube.points) {
        expect(biomeAt(p.x, p.y, salt)).toBe('lava');
        expect(inCave(p.x, p.y, salt)).toBe(true);
      }
      for (const e of tube.entrances) {
        expect(wallAt(e.x, e.y, salt)).toBe(false);
        expect(caveCellAt(e.x, e.y, salt)).toBe(3);
      }
      const { c, n } = solidSide(tube);
      const rim = tube.halfWidth + WORLD.rimPx / 2;
      expect(wallAt(c.x + n.x * rim, c.y + n.y * rim, salt)).toBe(true);
      const out = tube.halfWidth + WORLD.rimPx + 4;
      expect(inCave(c.x + n.x * out, c.y + n.y * out, salt)).toBe(false);
    }
  }
});

it('walls block a straight walk; skylights let the crew in; rovers keep out', () => {
  const salt = SITES.elysium.terrainSalt;
  const tube = worldFor(salt).tubes[0]!;
  const { c, n } = solidSide(tube);
  const outside = tube.halfWidth + WORLD.rimPx + 15;
  expect(moveBlocked(c.x + n.x * outside, c.y + n.y * outside, c.x, c.y, salt)).toBe(true);
  // Through a skylight: from open ground straight to the floor under it.
  const e = tube.entrances[0]!;
  let best = tube.points[0]!;
  for (const p of tube.points)
    if (Math.hypot(p.x - e.x, p.y - e.y) < Math.hypot(best.x - e.x, best.y - e.y)) best = p;
  const ux = (e.x - best.x) / Math.hypot(e.x - best.x, e.y - best.y);
  const uy = (e.y - best.y) / Math.hypot(e.x - best.x, e.y - best.y);
  const start = { x: e.x + ux * 20, y: e.y + uy * 20 };
  const floor = { x: best.x + ux * (tube.halfWidth - 10), y: best.y + uy * (tube.halfWidth - 10) };
  expect(moveBlocked(start.x, start.y, floor.x, floor.y, salt)).toBe(false);
  expect(inCave(floor.x, floor.y, salt)).toBe(true);
  // Rovers: the skylight is too tight, the floor and rim are off limits.
  const roverStart = { x: e.x + ux * 45, y: e.y + uy * 45 };
  expect(roverBlockedAt(roverStart.x, roverStart.y, salt)).toBe(false);
  expect(moveBlocked(roverStart.x, roverStart.y, floor.x, floor.y, salt, true)).toBe(true);
  expect(roverBlockedAt(floor.x, floor.y, salt)).toBe(true);
  // Sliding: a diagonal step into the rim keeps the free component.
  const from = { x: c.x + n.x * outside, y: c.y + n.y * outside };
  const end = slideMove(from.x, from.y, c.x, c.y, salt);
  expect(tubeDistance(tube, end.x, end.y)).toBeGreaterThanOrEqual(tube.halfWidth + WORLD.rimPx);
});

it('free mission and training keep the classic three rings and no caches', () => {
  for (const id of ['free', 'training'] as const) {
    const p = deriveParams(PRESETS.balanced, 9, id);
    expect(p.bigWorld).toBe(false);
    const sites = generateSites(p);
    expect(sites).toHaveLength(8);
    expect(sites.every((s) => Math.hypot(s.x - LANDER_POS.x, s.y - LANDER_POS.y) <= 710)).toBe(
      true,
    );
    expect(generateCaches(p, sites)).toEqual([]);
  }
});

it('RED SIGNAL spreads sites over every biome and into each lava tube', () => {
  for (const site of ['jezero', 'elysium', 'arcadia'] as const) {
    const p = deriveParams({ ...PRESETS.science, site }, 5, 'signal');
    expect(p.bigWorld).toBe(true);
    const salt = SITES[site].terrainSalt;
    const sites = generateSites(p);
    const big = sites.filter((s) => s.id.startsWith('B'));
    const caves = sites.filter((s) => s.id.startsWith('C'));
    expect(big.length).toBeGreaterThanOrEqual(BIG_SITES.perBiome * 4 - 2);
    const biomes = new Set(big.map((s) => biomeAt(s.x, s.y, salt)));
    expect(biomes.size).toBe(4);
    expect(caves).toHaveLength(worldFor(salt).tubes.length);
    for (const s of caves) {
      expect(inCave(s.x, s.y, salt)).toBe(true);
      expect(s.richness).toBe(3);
    }
    for (const s of big) expect(roverBlockedAt(s.x, s.y, salt)).toBe(false);
    expect(generateSites(p)).toEqual(sites);
  }
});

it('supply caches: in the outer biomes, full, clear of tubes and sites', () => {
  const p = deriveParams(PRESETS.science, 12, 'signal');
  const salt = SITES[p.site].terrainSalt;
  const sites = generateSites(p);
  const caches = generateCaches(p, sites);
  expect(caches.length).toBeGreaterThanOrEqual(CACHES.perBiome * 4 - 1);
  for (const c of caches) {
    expect(c.o2).toBe(CACHES.o2);
    expect(biomeAt(c.x, c.y, salt)).not.toBe('plains');
    expect(roverBlockedAt(c.x, c.y, salt)).toBe(false);
    expect(sites.every((s) => Math.hypot(s.x - c.x, s.y - c.y) >= BIG_SITES.clearance)).toBe(true);
  }
  expect(generateCaches(p, sites)).toEqual(caches);
});
