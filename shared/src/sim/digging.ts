import { DIG, SAMPLE } from '../balance';
import type { SampleTier } from '../types';
import { dist, pushFx, pushLog } from './sim';
import type { System } from './sim';

const THRESHOLDS: Array<[SampleTier, number]> = [
  ['surface', DIG.surfaceDepth],
  ['deep', DIG.deepDepth],
  ['core', DIG.coreDepth],
];

/** Excavation is shared; samples count as science only after airlock deposit. */
export const diggingSystem: System = (sim, dt) => {
  if (sim.pub.t < 0) return;
  for (const a of sim.pub.astronauts) {
    if (a.status !== 'active' || !a.digging) continue;
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
      if (site.kind === 'impact' && tier !== 'surface') continue;
      if (depth + Number.EPSILON < threshold || site.taken.includes(tier)) continue;
      if (a.carrying.length >= sim.params.carryCap) {
        site.depth = threshold - 0.001;
        a.digging = false;
        break;
      }
      const value = Math.round(
        site.kind === 'impact'
          ? SAMPLE.base[3]! * SAMPLE.impactMul
          : SAMPLE.base[site.richness]! *
              SAMPLE.tierMul[tier] *
              (site.kind === sim.params.favoredKind ? SAMPLE.favoredMul : 1),
      );
      a.carrying.push({ siteId: site.id, kind: site.kind, tier, value, by: a.id });
      site.taken.push(tier);
      pushFx(sim, { type: 'sample', playerId: a.id, x: site.x, y: site.y, n: value });
      pushLog(sim, a.id, 'log.sample_collected', { tier, value });
    }
  }
};
