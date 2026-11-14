import { O2, TICK_DT } from '../balance';
import { terrainMul } from './devils';
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
      let rate =
        a.digging || a.repairing ? O2.dig : a.moving ? (a.running ? O2.run : O2.walk) : O2.idle;
      if (a.leak) rate += O2.leakExtra;
      const environment = terrainMul(sim.pub, sim.salt, a.x, a.y);
      rate = rate * environment.o2 + environment.o2Extra;
      const spent = Math.min(a.o2, rate * dt);
      a.o2 = Math.max(0, a.o2 - spent);
      if (sim.params.scenario !== 'free') {
        if (environment.o2 > 1) sim.hidden.stats.sandSeconds += dt;
        if (environment.o2Extra > 0) sim.hidden.stats.devilSeconds += dt;
        const crew = sim.hidden.stats.crewStats.find((s) => s.id === a.id);
        if (crew) {
          crew.o2Used += spent;
          crew.secondsOutside += dt;
        }
      }
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
