import { finalizeObjectives } from './objectives';
import { pushFx } from './sim';
import type { Sim, System } from './sim';

export function endMission(sim: Sim): void {
  if (sim.pub.ended) return;
  const stats = sim.hidden.stats;
  for (const a of sim.pub.astronauts) {
    if (a.status === 'active' || a.status === 'down') {
      a.status = 'lost';
      stats.lost++;
    }
  }
  stats.endedAtS = Math.max(0, sim.pub.t);
  stats.allAboard = stats.lost === 0;
  stats.o2StoreLeft = sim.pub.lander.o2Store;
  finalizeObjectives(sim);
  // Ascent stage leaves (docs/product-logic.md 7.21): the takeoff scene and the report timeline.
  if (stats.lost < stats.crew) pushFx(sim, { type: 'liftoff', n: sim.pub.lander.cache.length });
  sim.pub.ended = true;
}

/**
 * Mission ends when time is up or the whole crew is lost. Sheltering inside the
 * lander does NOT end it: Mission Control decides when to lift off (mc:liftoff).
 */
export const endCheckSystem: System = (sim) => {
  if (sim.pub.ended || sim.pub.t < 0) return;
  const alive = sim.pub.astronauts.some((a) => a.status !== 'lost');
  if (sim.pub.t >= sim.pub.durationS || !alive) endMission(sim);
};
