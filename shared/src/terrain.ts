// Deterministic terrain. Server uses it for gameplay (ledges = rockfall risk),
// client uses the same functions to paint the world texture. Never send terrain
// over the network: both sides compute it from (site, seed).
import { LANDER_POS, WORLD_PX } from './balance';
import { SITES } from './catalog';
import { createRng } from './rng';
import type { MissionParams, SampleSite, SiteKind } from './types';

export const TERRAIN_LEVELS = 5;

/** Height 0..1 at world pixel (x, y). */
export function heightAt(x: number, y: number, salt: number): number {
  const h =
    0.5 +
    0.3 * Math.sin(x / 37 + 0.8 + salt) * Math.cos(y / 29 - 0.3 + salt * 0.7) +
    0.25 * Math.sin((x + 1.6 * y) / 41 + 2 + salt * 1.3) +
    0.1 * Math.sin(x / 11 + y / 13 + salt);
  return h < 0 ? 0 : h > 1 ? 1 : h;
}

/** Terrace level 0..4. */
export function levelAt(x: number, y: number, salt: number): number {
  const l = Math.floor(heightAt(x, y, salt) * 5.2);
  return l < 0 ? 0 : l > TERRAIN_LEVELS - 1 ? TERRAIN_LEVELS - 1 : l;
}

/** True if a terrace edge (ledge) lies within `dist` px of the point. */
export function nearLedge(x: number, y: number, salt: number, dist: number): boolean {
  const here = levelAt(x, y, salt);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    if (levelAt(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, salt) !== here) return true;
  }
  return false;
}

export function clampToWorld(v: number): number {
  const m = 8;
  return v < m ? m : v > WORLD_PX - m ? WORLD_PX - m : v;
}

/** Sample sites in three rings around the lander. Deterministic for (seed, site). */
export function generateSites(params: MissionParams): SampleSite[] {
  const site = SITES[params.site];
  const rng = createRng(params.seed ^ 0x51735);
  const kinds: SiteKind[] = [];
  (['delta', 'crater', 'basalt'] as const).forEach((k) => {
    for (let i = 0; i < site.mix[k]; i++) kinds.push(k);
  });
  const rings: Array<{ n: number; rMin: number; rMax: number; rich: 1 | 2 | 3 }> = [
    { n: 3, rMin: 220, rMax: 320, rich: 1 },
    { n: 3, rMin: 380, rMax: 520, rich: 2 },
    { n: 2, rMin: 600, rMax: 700, rich: 3 },
  ];
  const sites: SampleSite[] = [];
  let idx = 1;
  for (const ring of rings) {
    const offset = rng.range(0, Math.PI * 2);
    for (let i = 0; i < ring.n; i++) {
      const ang = offset + (i * Math.PI * 2) / ring.n + rng.range(-0.35, 0.35);
      const r = rng.range(ring.rMin, ring.rMax);
      sites.push({
        id: `S${idx++}`,
        x: Math.round(clampToWorld(LANDER_POS.x + Math.cos(ang) * r)),
        y: Math.round(clampToWorld(LANDER_POS.y + Math.sin(ang) * r)),
        kind: rng.pick(kinds),
        richness: ring.rich,
        depth: 0,
        taken: [],
        expiresAt: null,
        known: true,
      });
    }
  }
  return sites;
}
