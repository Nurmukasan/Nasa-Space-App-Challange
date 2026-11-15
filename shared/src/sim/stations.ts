// Seismometer kits deployed by the crew (docs/product-logic.md 7.7).
import { STATIONS } from '../balance';
import { sandAt } from '../terrain';
import type { Astronaut } from '../types';
import { dist, pushFx, pushLog } from './sim';
import type { Sim } from './sim';

/** E-key step 5: deploy a carried kit here. Returns true if the key press was used. */
export function tryDeployKit(sim: Sim, a: Astronaut): boolean {
  if (
    sim.params.scenario === 'free' ||
    sim.pub.t < 0 ||
    sim.pub.ended ||
    a.status !== 'active' ||
    a.kits <= 0
  )
    return false;
  if (dist(a.x, a.y, sim.pub.lander.x, sim.pub.lander.y) < STATIONS.minFromLander) return false;
  if (sim.pub.stations.some((s) => dist(a.x, a.y, s.x, s.y) < STATIONS.minBetween)) return false;
  if (sandAt(a.x, a.y, sim.salt, sim.params.bigWorld)) return false;
  sim.pub.stations.push({ x: a.x, y: a.y });
  a.kits--;
  sim.hidden.stats.stationsDeployed++;
  pushFx(sim, { type: 'deploy', playerId: a.id, x: a.x, y: a.y });
  pushLog(sim, a.id, 'log.deploy', { n: sim.pub.stations.length });
  return true;
}
