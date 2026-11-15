// Big-world rules (docs/product-logic.md 7.24–7.27): the rover, oxygen supply caches, first steps
// into each biome and time spent sheltering in lava tubes. Nothing here runs outside the big world.
import { CACHES, LANDER_POS, ROVER, TICK_DT, WEATHER } from '../balance';
import type { Astronaut, EvaState, MissionParams } from '../types';
import { biomeAt, inCave } from '../world';
import { clampToWorld, sandAt } from '../terrain';
import { SITES } from '../catalog';
import { stormActive } from './weather';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

/** Legal rover speed at (x, y), px/s; zero on an empty battery. */
export function roverSpeed(params: MissionParams, state: EvaState, x: number, y: number): number {
  const rover = state.rover;
  if (!rover || rover.charge <= 0) return 0;
  const salt = SITES[params.site].terrainSalt;
  const ground = sandAt(x, y, salt)
    ? ROVER.sandMul
    : biomeAt(x, y, salt) === 'lava'
      ? ROVER.lavaMul
      : 1;
  return ROVER.speed * ground * (stormActive(state.weather) ? WEATHER.stormSpeed : 1);
}

/** E-key step: get in (near a parked rover) or out (while driving). */
export function tryRover(sim: Sim, a: Astronaut): boolean {
  const rover = sim.pub.rover;
  if (!rover) return false;
  if (a.inRover) {
    a.inRover = false;
    rover.driver = null;
    rover.moving = false;
    // Step out beside the cab.
    a.x = clampToWorld(rover.x - Math.sin(rover.facing) * ROVER.exitOffset);
    a.y = clampToWorld(rover.y + Math.cos(rover.facing) * ROVER.exitOffset);
    pushFx(sim, { type: 'rover', playerId: a.id, x: rover.x, y: rover.y, s: 'exit' });
    return true;
  }
  if (rover.driver !== null || dist(a.x, a.y, rover.x, rover.y) > ROVER.boardDist) return false;
  rover.driver = a.id;
  a.inRover = true;
  a.x = rover.x;
  a.y = rover.y;
  a.digging = false;
  a.moving = false;
  a.running = false;
  a.repairing = null;
  pushFx(sim, { type: 'rover', playerId: a.id, x: rover.x, y: rover.y, s: 'board' });
  return true;
}

/** E-key step: refill the suit from a nearby supply cache. */
export function tryCache(sim: Sim, a: Astronaut): boolean {
  const cache = sim.pub.caches.find((c) => c.o2 > 0 && dist(a.x, a.y, c.x, c.y) <= CACHES.useDist);
  if (!cache) return false;
  const give = Math.min(cache.o2, a.o2Max - a.o2);
  if (give <= 0) return false;
  cache.o2 -= give;
  a.o2 += give;
  // The depot carries suit patches too.
  a.leak = false;
  sim.hidden.stats.cacheRefills++;
  pushFx(sim, { type: 'cache', playerId: a.id, x: cache.x, y: cache.y, n: Math.round(give) });
  pushLog(sim, a.id, 'log.cache', { id: cache.id, n: Math.round(cache.o2) });
  return true;
}

export const expeditionSystem: System = (sim, dt) => {
  if (!sim.params.bigWorld || sim.pub.t < 0) return;
  const rover = sim.pub.rover;
  if (rover) {
    const driver = rover.driver ? sim.pub.astronauts.find((a) => a.id === rover.driver) : null;
    // A driver who is gone (lost, inside, disconnected) frees the seat.
    if (rover.driver && (!driver || driver.status !== 'active' || !driver.inRover)) {
      rover.driver = null;
      if (driver) driver.inRover = false;
    }
    const last = rover.driver ? (sim.hidden.lastMoveT[rover.driver] ?? -999) : -999;
    if (sim.pub.t - last > TICK_DT * 4) rover.moving = false;
    if (!rover.moving && dist(rover.x, rover.y, LANDER_POS.x, LANDER_POS.y) <= ROVER.dockDist)
      rover.charge = Math.min(1, rover.charge + dt / ROVER.rechargeS);
  }
  const stats = sim.hidden.stats;
  for (const a of sim.pub.astronauts) {
    if (a.status !== 'active') continue;
    if (inCave(a.x, a.y, sim.salt)) stats.caveSeconds += dt;
    const biome = biomeAt(a.x, a.y, sim.salt);
    if (biome === 'plains' || stats.biomesVisited.includes(biome)) continue;
    stats.biomesVisited.push(biome);
    pushFx(sim, { type: 'biome', playerId: a.id, x: a.x, y: a.y, s: biome });
    pushLog(sim, 'tulpar', `log.biome.${biome}`, { id: a.id });
  }
};
