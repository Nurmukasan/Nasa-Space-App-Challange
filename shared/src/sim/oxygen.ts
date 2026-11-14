import { O2, TICK_DT } from '../balance';
import { pushFx, pushLog } from './sim';
import type { System } from './sim';

/** Suit oxygen: consumption by activity, blackout at zero, loss if nobody helps in time. */
export const oxygenSystem: System = (sim, dt) => {
  const t = sim.pub.t;
  if (t < 0) return;
  for (const a of sim.pub.astronauts) {
    if (a.status === 'active') {
      // A client that stopped sending moves is standing still.
      const last = sim.hidden.lastMoveT[a.id] ?? -999;
      if (t - last > TICK_DT * 4) {
        a.moving = false;
        a.running = false;
      }
      let rate = a.digging ? O2.dig : a.moving ? (a.running ? O2.run : O2.walk) : O2.idle;
      if (a.leak) rate += O2.leakExtra;
      a.o2 = Math.max(0, a.o2 - rate * dt);
      sim.hidden.stats.secondsOutside += dt;
      if (a.o2 <= 0) {
        a.status = 'down';
        a.downUntil = t + O2.downSeconds;
        a.moving = false;
        a.running = false;
        a.digging = false;
        sim.hidden.stats.downs++;
        pushFx(sim, { type: 'down', playerId: a.id, x: a.x, y: a.y });
        pushLog(sim, 'sys', 'log.down', { id: a.id });
      }
    } else if (a.status === 'down' && t >= a.downUntil) {
      a.status = 'lost';
      sim.hidden.stats.lost++;
      pushFx(sim, { type: 'lost', playerId: a.id, x: a.x, y: a.y });
      pushLog(sim, 'sys', 'log.lost', { id: a.id });
    }
  }
};
