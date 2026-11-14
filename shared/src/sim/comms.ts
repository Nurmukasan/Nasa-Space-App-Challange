import { COMMS } from '../balance';
import { dist } from './sim';
import type { System } from './sim';

/** Telemetry link: inside range (scaled by comms efficiency) or lost. Relay passes: TODO (A6). */
export const commsSystem: System = (sim) => {
  const { lander } = sim.pub;
  const range =
    sim.params.commsRange * (COMMS.minEffMul + (1 - COMMS.minEffMul) * lander.power.eff.comms);
  for (const a of sim.pub.astronauts) {
    a.linked = a.status === 'inside' || dist(a.x, a.y, lander.x, lander.y) <= range;
  }
};
