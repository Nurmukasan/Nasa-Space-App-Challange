// The fixed pipeline. Order matters; change it only in a contract PR.
import { commsSystem } from './comms';
import { devilSystem } from './devils';
import { diggingSystem } from './digging';
import { directorSystem } from './director';
import { discoverySystem } from './discovery';
import { endCheckSystem } from './endcheck';
import { expeditionSystem } from './expedition';
import { faultSystem } from './faults';
import { flareSystem } from './flare';
import { hazardSystem } from './hazards';
import { landerSystem } from './lander';
import { objectivesSystem } from './objectives';
import { oxygenSystem } from './oxygen';
import { powerSystem } from './power';
import { seismicSystem } from './seismic';
import { signalSystem } from './signal';
import type { Sim, System } from './sim';
import { weatherSystem } from './weather';

/** v2 order: docs/architecture.md 6.2. */
const PIPELINE: System[] = [
  directorSystem,
  weatherSystem,
  flareSystem,
  powerSystem,
  commsSystem,
  devilSystem,
  oxygenSystem,
  expeditionSystem,
  diggingSystem,
  discoverySystem,
  faultSystem,
  landerSystem,
  seismicSystem,
  signalSystem,
  hazardSystem,
  objectivesSystem,
  endCheckSystem,
];

const FX_TTL_S = 2;

export function stepSim(sim: Sim, dt: number): void {
  if (sim.pub.ended) return;
  sim.pub.t += dt;
  sim.pub.tick++;
  for (const system of PIPELINE) system(sim, dt);
  const fx = sim.pub.fx;
  while (fx.length > 0 && sim.pub.t - fx[0]!.t > FX_TTL_S) fx.shift();
}
