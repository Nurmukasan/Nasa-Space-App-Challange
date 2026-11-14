import { O2, SEISMIC } from '../balance';
import { nearLedge } from '../terrain';
import { dist, pushFx } from './sim';
import type { System } from './sim';

/** Unwarned rockfalls become public only at impact; every pending hit runs once. */
export const hazardSystem: System = (sim) => {
  const t = sim.pub.t;
  for (const hazard of sim.hidden.pendingRockfalls) {
    if (hazard.hit || t < hazard.tHit) continue;
    hazard.hit = true;
    const zone = sim.pub.hazards.find((h) => h.id === hazard.id);
    if (zone) {
      // The warning zone "jumps" to the real epicentre: everyone sees how good the pick was.
      zone.x = hazard.x;
      zone.y = hazard.y;
      zone.r = hazard.r;
    } else {
      const { hit: _, ...publicHazard } = hazard;
      sim.pub.hazards.push(publicHazard);
    }
    for (const a of sim.pub.astronauts) {
      if (
        a.status !== 'active' ||
        dist(a.x, a.y, hazard.x, hazard.y) > hazard.r ||
        !nearLedge(a.x, a.y, sim.salt, SEISMIC.ledgeHitDist)
      )
        continue;
      a.o2 = Math.max(0, a.o2 - O2.breachLoss);
      a.leak = true;
      sim.hidden.stats.breaches++;
      pushFx(sim, { type: 'breach', playerId: a.id, x: a.x, y: a.y });
    }
    pushFx(sim, { type: 'rockfall', x: hazard.x, y: hazard.y });
  }
  sim.pub.hazards = sim.pub.hazards.filter((h) => t < h.tHit + SEISMIC.hazardKeepS);
  sim.hidden.pendingRockfalls = sim.hidden.pendingRockfalls.filter(
    (h) => t < h.tHit + SEISMIC.hazardKeepS,
  );
  sim.pub.sites = sim.pub.sites.filter((s) => s.expiresAt === null || t < s.expiresAt);
};
