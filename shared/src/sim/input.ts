// Applies client messages to the sim. Every value from the client is validated here.
import { MOVE, O2, TICK_DT } from '../balance';
import type { ClientMsg } from '../protocol';
import { clampToWorld } from '../terrain';
import { endMission } from './endcheck';
import { moveSpeed } from './movement';
import { dist, findAstronaut, pushFx, pushLog } from './sim';
import type { Sim } from './sim';

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function handleSimMsg(
  sim: Sim,
  playerId: string,
  canEva: boolean,
  canMc: boolean,
  msg: ClientMsg,
): void {
  if (sim.pub.ended) return;
  const t = sim.pub.t;
  switch (msg.t) {
    case 'eva:move': {
      if (!canEva || t < 0) return;
      const a = findAstronaut(sim, playerId);
      if (!a || a.status !== 'active') return;
      if (!num(msg.x) || !num(msg.y) || !num(msg.facing)) return;
      const running = msg.running === true;
      const last = sim.hidden.lastMoveT[playerId] ?? t - TICK_DT;
      const elapsed = Math.min(0.5, Math.max(TICK_DT, t - last));
      const maxStep = moveSpeed(sim.params, sim.pub.weather, running) * elapsed * MOVE.slack;
      let nx = clampToWorld(msg.x);
      let ny = clampToWorld(msg.y);
      const d = dist(a.x, a.y, nx, ny);
      if (d > maxStep) {
        const k = maxStep / d;
        nx = a.x + (nx - a.x) * k;
        ny = a.y + (ny - a.y) * k;
      }
      const moved = dist(a.x, a.y, nx, ny);
      if (running) sim.hidden.stats.distanceRun += moved;
      else sim.hidden.stats.distanceWalked += moved;
      a.x = nx;
      a.y = ny;
      a.facing = msg.facing;
      a.moving = msg.moving === true && moved > 0.01;
      a.running = a.moving && running;
      if (a.moving) a.digging = false;
      sim.hidden.lastMoveT[playerId] = t;
      return;
    }
    case 'eva:dig': {
      if (!canEva || t < 0) return;
      const a = findAstronaut(sim, playerId);
      if (a && a.status === 'active') a.digging = msg.on === true;
      return;
    }
    case 'eva:interact': {
      if (!canEva || t < 0) return;
      const a = findAstronaut(sim, playerId);
      if (!a) return;
      const lander = sim.pub.lander;
      if (a.status === 'inside') {
        a.status = 'active';
        return;
      }
      if (a.status !== 'active') return;
      if (dist(a.x, a.y, lander.x, lander.y) > O2.airlockRadius) return;
      if (a.carrying.length > 0) {
        for (const s of a.carrying) {
          lander.cache.push(s);
          sim.hidden.stats.samplesDeposited++;
          if (s.tier !== 'surface') sim.hidden.stats.deepDeposited++;
          sim.hidden.stats.scienceRaw += s.value;
        }
        pushFx(sim, { type: 'deposit', playerId, n: a.carrying.length });
        a.carrying = [];
      }
      if (a.o2 < a.o2Max * 0.98) {
        if (!a.wantsRefill) sim.hidden.stats.refills++;
        a.wantsRefill = true;
      } else {
        a.status = 'inside';
        a.moving = false;
        a.running = false;
        a.digging = false;
      }
      return;
    }
    case 'eva:ping': {
      if (!canEva) return;
      const kind = String(msg.kind).slice(0, 16);
      pushFx(sim, { type: 'ping', playerId, s: kind });
      pushLog(sim, playerId, `ping.${kind}`);
      return;
    }
    case 'mc:waypoint': {
      if (!canMc || !num(msg.x) || !num(msg.y)) return;
      const a = findAstronaut(sim, String(msg.playerId));
      if (a) a.waypoint = { x: clampToWorld(msg.x), y: clampToWorld(msg.y) };
      return;
    }
    case 'mc:clearWaypoint': {
      if (!canMc) return;
      const a = findAstronaut(sim, String(msg.playerId));
      if (a) a.waypoint = null;
      return;
    }
    case 'mc:power': {
      if (!canMc || !msg.alloc) return;
      const { moxie, comms, scan } = msg.alloc;
      if (!num(moxie) || !num(comms) || !num(scan)) return;
      if (moxie < 0 || comms < 0 || scan < 0) return;
      const sum = moxie + comms + scan;
      if (sum <= 0) return;
      sim.pub.lander.power.alloc = { moxie: moxie / sum, comms: comms / sum, scan: scan / sum };
      return;
    }
    case 'mc:alert': {
      if (!canMc) return;
      const kind = String(msg.kind).slice(0, 16);
      pushFx(sim, { type: 'alert', playerId: String(msg.playerId), s: kind });
      pushLog(sim, 'mc', `alert.${kind}`, { id: String(msg.playerId) });
      return;
    }
    case 'mc:liftoff': {
      if (canMc && t >= 0) endMission(sim);
      return;
    }
    case 'mc:ration': {
      if (canMc) sim.pub.lander.ration = msg.on === true;
      return;
    }
    case 'mc:dispense': {
      if (!canMc) return;
      const a = findAstronaut(sim, String(msg.playerId));
      if (a && a.wantsRefill) a.refillGranted = true;
      return;
    }
    // TODO (start-phase A3): mc:classify
    default:
      return;
  }
}
