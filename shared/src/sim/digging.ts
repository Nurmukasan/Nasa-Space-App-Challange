import { CREW, DIG, DIG_GAME, SAMPLE, SIGNAL } from '../balance';
import type { Astronaut, MissionParams, SampleSite, SampleTier } from '../types';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

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

/** Free mission digs while SPACE is held (v1); training and RED SIGNAL use strokes (PL 7.5.1). */
export function digGameOn(params: MissionParams): boolean {
  return params.scenario !== 'free';
}

/** Stop digging and close any mini-game session. */
export function stopDig(a: Astronaut): void {
  a.digging = false;
  a.dig = null;
}

/** Nearest open site within reach, or undefined. */
export function siteInReach(sim: Sim, a: Astronaut): SampleSite | undefined {
  return sim.pub.sites
    .filter(
      (s) =>
        (s.expiresAt === null || s.expiresAt > sim.pub.t) && dist(a.x, a.y, s.x, s.y) <= DIG.reach,
    )
    .sort((s, b) => dist(a.x, a.y, s.x, s.y) - dist(a.x, a.y, b.x, b.y))[0];
}

/** Deepen `site` by `amount` metres and hand out every sample threshold crossed. */
export function excavate(sim: Sim, a: Astronaut, site: SampleSite, amount: number): void {
  const depth = Math.min(sim.params.maxDepth, site.depth + amount);
  site.depth = depth;
  for (const [tier, threshold] of THRESHOLDS) {
    if (!yields(site, tier)) continue;
    if (depth + Number.EPSILON < threshold || site.taken.includes(tier)) continue;
    if (a.carrying.length >= sim.params.carryCap) {
      site.depth = threshold - DIG.thresholdEpsilon;
      stopDig(a);
      break;
    }
    const value = Math.round(sampleValue(site, tier, sim.params) * CREW.sampleMul[a.crewClass]);
    a.carrying.push({ siteId: site.id, kind: site.kind, tier, value, by: a.id });
    site.taken.push(tier);
    pushFx(sim, { type: 'sample', playerId: a.id, x: site.x, y: site.y, n: value });
    pushLog(sim, a.id, 'log.sample_collected', { tier, value });
    // Do not spend the rest of this tick excavating with a full inventory.
    if (a.carrying.length >= sim.params.carryCap) {
      site.depth = threshold;
      stopDig(a);
      break;
    }
  }
}

/** Excavation is shared; samples count as science only after airlock deposit. */
export const diggingSystem: System = (sim, dt) => {
  if (sim.pub.t < 0) return;
  const game = digGameOn(sim.params);
  for (const a of sim.pub.astronauts) {
    if (game) {
      // Strokes dig (digGame.ts); here a session only ends.
      if (a.dig && !digSessionValid(sim, a)) stopDig(a);
      continue;
    }
    if (a.status !== 'active' || !a.digging) continue;
    if (a.carrying.length >= sim.params.carryCap) {
      a.digging = false;
      continue;
    }
    const site = siteInReach(sim, a);
    if (!site) {
      a.digging = false;
      continue;
    }
    excavate(sim, a, site, sim.params.digRate * CREW.digMul[a.crewClass] * dt);
  }
};

/** A mini-game session lasts while the astronaut stands at a site with a free hand. */
export function digSessionValid(sim: Sim, a: Astronaut): boolean {
  return (
    a.status === 'active' &&
    !a.inRover &&
    a.carrying.length < sim.params.carryCap &&
    !!a.dig &&
    sim.pub.t - a.dig.lastT <= DIG_GAME.idleS &&
    !!siteInReach(sim, a)
  );
}
