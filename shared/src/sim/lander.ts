import { O2 } from '../balance';
import { faultActive } from './faults';
import { dist, pushFx } from './sim';
import type { System } from './sim';

/** MOXIE fills the store; astronauts at the airlock with wantsRefill drain it. */
export const landerSystem: System = (sim, dt) => {
  if (sim.pub.t < 0) return;
  const lander = sim.pub.lander;
  lander.o2Store = Math.min(
    lander.o2StoreMax,
    lander.o2Store +
      (faultActive(sim, 'moxie_clog') ? 0 : sim.params.moxieRate * lander.power.eff.moxie * dt),
  );
  for (const a of sim.pub.astronauts) {
    if (!a.wantsRefill || a.status !== 'active') continue;
    if (dist(a.x, a.y, lander.x, lander.y) > O2.airlockRadius) {
      a.wantsRefill = false;
      a.refillGranted = false;
      continue;
    }
    if (lander.ration && !a.refillGranted) continue; // waiting for Mission Control
    const give = Math.min(O2.refillRate * dt, a.o2Max - a.o2, lander.o2Store);
    a.o2 += give;
    lander.o2Store -= give;
    sim.hidden.stats.o2Dispensed += give;
    if (a.leak) a.leak = false; // suit patched at the airlock
    if (a.o2 >= a.o2Max - 0.01 || lander.o2Store <= 0) {
      a.wantsRefill = false;
      a.refillGranted = false;
      pushFx(sim, { type: 'refill', playerId: a.id });
    }
  }
};
