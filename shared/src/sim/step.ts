// The fixed pipeline. Order matters; change it only in a contract PR.
import { commsSystem } from './comms';
import { diggingSystem } from './digging';
import { endCheckSystem } from './endcheck';
import { hazardSystem } from './hazards';
import { landerSystem } from './lander';
import { oxygenSystem } from './oxygen';
import { powerSystem } from './power';
import { seismicSystem } from './seismic';
import type { Sim, System } from './sim';
import { weatherSystem } from './weather';

const PIPELINE: System[] = [
  weatherSystem,
  powerSystem,
  commsSystem,
  oxygenSystem,
  diggingSystem,
  landerSystem,
  seismicSystem,
  hazardSystem,
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
