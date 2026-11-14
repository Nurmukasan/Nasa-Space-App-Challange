import { COMMS, WEATHER } from '../balance';
import { stormActive } from './weather';
import { dist } from './sim';
import type { System } from './sim';

/** Telemetry range and periodic low-orbit relay passes. */
export const commsSystem: System = (sim) => {
  const { lander } = sim.pub;
  const t = sim.pub.t;
  const relay = sim.pub.relay;
  if (sim.params.relay === 'low_orbit') {
    const elapsed = t - COMMS.relayFirstOpenS;
    const phase = elapsed < 0 ? -1 : elapsed % sim.params.relayPassPeriodS;
    relay.open = phase >= 0 && phase < sim.params.relayPassWindowS;
    relay.nextChangeAt =
      elapsed < 0
        ? COMMS.relayFirstOpenS
        : t - phase + (relay.open ? sim.params.relayPassWindowS : sim.params.relayPassPeriodS);
  } else {
    relay.open = false;
    relay.nextChangeAt = 0;
  }
  const range =
    sim.params.commsRange *
    (stormActive(sim.pub.weather) ? WEATHER.stormComms : 1) *
    (COMMS.minEffMul + (1 - COMMS.minEffMul) * lander.power.eff.comms);
  for (const a of sim.pub.astronauts) {
    a.linked = a.status === 'inside' || relay.open || dist(a.x, a.y, lander.x, lander.y) <= range;
  }
};
