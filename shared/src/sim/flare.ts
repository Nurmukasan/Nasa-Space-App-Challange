// Solar particle event and radiation dose (docs/product-logic.md 7.15).
// Earth warns ahead; while it lasts, crew outside the lander accumulate dose.
import { FLARE } from '../balance';
import { inCave } from '../world';
import { pushFx } from './sim';
import type { Sim, System } from './sim';

/** Director/beat hook: warn at warnAt, flare from warnAt + leadS for durS seconds. */
export function scheduleFlare(sim: Sim, warnAt: number, leadS: number, durS: number): void {
  const tStart = warnAt + leadS;
  sim.hidden.flare = { warnAt, tStart, tEnd: tStart + durS };
  sim.hidden.flarePhase = 0;
}

/** Safety penalty for the worst dose above the limit (docs/product-logic.md 8.1). */
export function dosePenalty(doseMax: number): number {
  return Math.floor(Math.max(0, doseMax - FLARE.doseLimit) / 10) * FLARE.penaltyPer10;
}

export const flareSystem: System = (sim, dt) => {
  const plan = sim.hidden.flare;
  const t = sim.pub.t;
  if (!plan || t < plan.warnAt) return;
  const h = sim.hidden;
  if (h.flarePhase === 0) {
    sim.pub.flare = { ...plan };
    h.flarePhase = 1;
    pushFx(sim, { type: 'flare_warn', n: Math.round(plan.tStart - t) });
  }
  if (h.flarePhase === 1 && t >= plan.tStart) {
    h.flarePhase = 2;
    pushFx(sim, { type: 'flare_start' });
  }
  if (h.flarePhase === 2 && t >= plan.tEnd) {
    h.flarePhase = 3;
    pushFx(sim, { type: 'flare_end' });
  }
  if (h.flarePhase !== 2) return;
  // The hull, the rover cabin or the rock over a lava tube protects; everyone else soaks up dose.
  for (const a of sim.pub.astronauts) {
    if (a.status !== 'active' && a.status !== 'down') continue;
    if (a.inRover || (sim.params.bigWorld && inCave(a.x, a.y, sim.salt))) continue;
    a.dose += FLARE.doseRate * dt;
    h.stats.doseMax = Math.max(h.stats.doseMax, a.dose);
  }
};
