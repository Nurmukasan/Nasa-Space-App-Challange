import { DIG, SAMPLE, SIGNAL } from '../balance';
import type { MissionParams, SampleSite, SampleTier } from '../types';
import { dist, pushFx, pushLog } from './sim';
import type { System } from './sim';

const THRESHOLDS: Array<[SampleTier, number]> = [
  ['surface', DIG.surfaceDepth],
  ['deep', DIG.deepDepth],
  ['core', DIG.coreDepth],
];

/** Value of a sample of `tier` from `site` (docs/product-logic.md 7.5). */
export function sampleValue(site: SampleSite, tier: SampleTier, params: MissionParams): number {
  if (site.kind === 'impact') return Math.round(SAMPLE.base[3]! * SAMPLE.impactMul);
  if (site.kind === 'signal')
    return Math.round((SIGNAL.sampleValue * SAMPLE.tierMul[tier]) / SAMPLE.tierMul.deep);
  return Math.round(
    SAMPLE.base[site.richness]! *
      SAMPLE.tierMul[tier] *
      (site.kind === params.favoredKind ? SAMPLE.favoredMul : 1),
  );
}

/** Tiers a site can yield: impact ice only at the surface, the signal source only deep. */
function yields(site: SampleSite, tier: SampleTier): boolean {
  if (site.kind === 'impact') return tier === 'surface';
  if (site.kind === 'signal') return tier !== 'surface';
  return true;
}

/** Excavation is shared; samples count as science only after airlock deposit. */
export const diggingSystem: System = (sim, dt) => {
  if (sim.pub.t < 0) return;
  for (const a of sim.pub.astronauts) {
    if (a.status !== 'active' || !a.digging) continue;
    if (a.carrying.length >= sim.params.carryCap) {
      a.digging = false;
      continue;
    }
    const site = sim.pub.sites
      .filter(
        (s) =>
          (s.expiresAt === null || s.expiresAt > sim.pub.t) &&
          dist(a.x, a.y, s.x, s.y) <= DIG.reach,
      )
      .sort((s, b) => dist(a.x, a.y, s.x, s.y) - dist(a.x, a.y, b.x, b.y))[0];
    if (!site) {
      a.digging = false;
      continue;
    }
    const depth = Math.min(sim.params.maxDepth, site.depth + sim.params.digRate * dt);
    site.depth = depth;
    for (const [tier, threshold] of THRESHOLDS) {
      if (!yields(site, tier)) continue;
      if (depth + Number.EPSILON < threshold || site.taken.includes(tier)) continue;
      if (a.carrying.length >= sim.params.carryCap) {
        site.depth = threshold - DIG.thresholdEpsilon;
        a.digging = false;
        break;
      }
      const value = sampleValue(site, tier, sim.params);
      a.carrying.push({ siteId: site.id, kind: site.kind, tier, value, by: a.id });
      site.taken.push(tier);
      pushFx(sim, { type: 'sample', playerId: a.id, x: site.x, y: site.y, n: value });
      pushLog(sim, a.id, 'log.sample_collected', { tier, value });
      // Do not spend the rest of this tick excavating with a full inventory.
      if (a.carrying.length >= sim.params.carryCap) {
        site.depth = threshold;
        a.digging = false;
        break;
      }
    }
  }
};
