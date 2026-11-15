import { COMMS, FAULTS, ROVER, WEATHER } from '../balance';
import { inCave } from '../world';
import { faultActive } from './faults';
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
    (COMMS.minEffMul + (1 - COMMS.minEffMul) * lander.power.eff.comms) *
    (faultActive(sim, 'antenna_drift') ? FAULTS.antennaMul : 1);
  // Big world: the rover's antenna relays for crew near it while it is within reach of home.
  const rover = sim.pub.rover;
  const roverLinked =
    !!rover &&
    !inCave(rover.x, rover.y, sim.salt) &&
    (relay.open || dist(rover.x, rover.y, lander.x, lander.y) <= range * ROVER.antennaMul);
  for (const a of sim.pub.astronauts) {
    if (a.status === 'inside') {
      a.linked = true;
      continue;
    }
    // Rock overhead: no radio inside a lava tube.
    if (sim.params.bigWorld && inCave(a.x, a.y, sim.salt)) {
      a.linked = false;
      continue;
    }
    a.linked =
      relay.open ||
      dist(a.x, a.y, lander.x, lander.y) <= range ||
      (roverLinked && (a.inRover || dist(a.x, a.y, rover!.x, rover!.y) <= range));
  }
};
