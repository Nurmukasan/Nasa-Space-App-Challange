// Big-world content placed from the mission seed (docs/product-logic.md 7.24–7.27): sample sites in
// every outer biome, one rich site inside each lava tube and oxygen supply caches.
import { BIG_SITES, CACHES, LANDER_POS } from './balance';
import { SITES } from './catalog';
import { createRng } from './rng';
import type { Rng } from './rng';
import type { BiomeId, MissionParams, SampleSite, SiteKind, SupplyCache, Vec2 } from './types';
import { OUTER_BIOMES, biomeAt, tubeAt, worldFor } from './world';

/** What each biome yields: river sediments, ice under crater rims, basalt, dune-floor bedrock. */
const KINDS: Record<Exclude<BiomeId, 'plains'>, SiteKind[]> = {
  delta: ['delta'],
  dunes: ['basalt', 'delta'],
  ice: ['crater'],
  lava: ['basalt'],
};

/** A free spot in `biome`, between minD and maxD from the lander, clear of tubes and `taken`. */
function placeIn(
  rng: Rng,
  salt: number,
  biome: Exclude<BiomeId, 'plains'>,
  minD: number,
  maxD: number,
  taken: Vec2[],
): Vec2 | null {
  const def = worldFor(salt);
  const sector = def.sectors.find((s) => s.biome === biome)!;
  for (let i = 0; i < BIG_SITES.attempts; i++) {
    const a = def.rotation + sector.from + (sector.to - sector.from) * rng.range(0.1, 0.9);
    const r = rng.range(minD, maxD);
    const p = {
      x: Math.round(LANDER_POS.x + Math.cos(a) * r),
      y: Math.round(LANDER_POS.y + Math.sin(a) * r),
    };
    if (biomeAt(p.x, p.y, salt) !== biome) continue;
    const near = tubeAt(p.x, p.y, salt);
    if (near && near.d < near.tube.halfWidth + BIG_SITES.clearance) continue;
    if (taken.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < BIG_SITES.clearance)) continue;
    return p;
  }
  return null;
}

/** Sites beyond the classic rings. Richness doubles as the orbital ring index (2–3: hidden). */
export function bigWorldSites(params: MissionParams, existing: readonly Vec2[]): SampleSite[] {
  if (!params.bigWorld) return [];
  const salt = SITES[params.site].terrainSalt;
  const rng = createRng((params.seed ^ 0xb16e) >>> 0);
  const taken: Vec2[] = existing.map((s) => ({ x: s.x, y: s.y }));
  const out: SampleSite[] = [];
  const mid = (BIG_SITES.minDist + BIG_SITES.maxDist) / 2;
  let n = 1;
  for (const biome of OUTER_BIOMES) {
    for (let i = 0; i < BIG_SITES.perBiome; i++) {
      const p = placeIn(rng, salt, biome, BIG_SITES.minDist, BIG_SITES.maxDist, taken);
      if (!p) continue;
      const far = Math.hypot(p.x - LANDER_POS.x, p.y - LANDER_POS.y) > mid;
      out.push({
        id: `B${n++}`,
        ...p,
        kind: KINDS[biome][i % KINDS[biome].length]!,
        richness: far ? 3 : 2,
        depth: 0,
        taken: [],
        expiresAt: null,
        known: true,
      });
      taken.push(p);
    }
  }
  // Lava tubes shelter the richest finds: basalt walls and cave ice in turn.
  worldFor(salt).tubes.forEach((tube, i) => {
    const centre = tube.points[Math.floor(tube.points.length / 2)]!;
    out.push({
      id: `C${i + 1}`,
      x: centre.x,
      y: centre.y,
      kind: i % 2 === 0 ? 'basalt' : 'crater',
      richness: 3,
      depth: 0,
      taken: [],
      expiresAt: null,
      known: true,
    });
  });
  return out;
}

/** Oxygen depots: two per outer biome, clear of sites and tubes. */
export function generateCaches(params: MissionParams, sites: readonly Vec2[]): SupplyCache[] {
  if (!params.bigWorld) return [];
  const salt = SITES[params.site].terrainSalt;
  const rng = createRng((params.seed ^ 0xcac4e) >>> 0);
  const taken: Vec2[] = sites.map((s) => ({ x: s.x, y: s.y }));
  const out: SupplyCache[] = [];
  for (const biome of OUTER_BIOMES)
    for (let i = 0; i < CACHES.perBiome; i++) {
      const p = placeIn(rng, salt, biome, CACHES.minDist, CACHES.maxDist, taken);
      if (!p) continue;
      out.push({ id: `K${out.length + 1}`, ...p, o2: CACHES.o2 });
      taken.push(p);
    }
  return out;
}
