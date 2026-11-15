// Applies client messages to the sim. Every value from the client is validated here.
import { AIRLOCK, MOVE, O2, TICK_DT } from '../balance';
import type { AlertKind, ClientMsg, PingKind } from '../protocol';

const PING_KINDS: readonly unknown[] = [
  'ok',
  'help',
  'low_o2',
  'returning',
  'found',
  'shaking',
] satisfies PingKind[];
const ALERT_KINDS: readonly unknown[] = ['evac', 'return', 'hold'] satisfies AlertKind[];
import { clampToWorld } from '../terrain';
import { endMission } from './endcheck';
import { placePick, resolveEvent } from './seismic';
import { fieldSpeed } from './movement';
import { crewStatsOf, dist, findAstronaut, pushFx, pushLog } from './sim';
import { tryStartRepair } from './faults';
import { tryDeployKit } from './stations';
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
      const maxStep =
        fieldSpeed(sim.params, sim.pub, a.x, a.y, running, a.crewClass) * elapsed * MOVE.slack;
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
      const mine = crewStatsOf(sim, a.id);
      if (mine) mine.distance += moved;
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
      const down = sim.pub.astronauts.find(
        (b) =>
          b.id !== a.id &&
          b.status === 'down' &&
          t < b.downUntil &&
          dist(a.x, a.y, b.x, b.y) <= O2.shareRange,
      );
      if (down && a.o2 > O2.shareAmount + O2.shareReserve) {
        a.o2 -= O2.shareAmount;
        down.o2 = O2.shareAmount;
        down.status = 'active';
        down.downUntil = 0;
        sim.hidden.stats.o2Shared += O2.shareAmount;
        const rescuer = crewStatsOf(sim, a.id);
        if (rescuer) rescuer.rescues++;
        pushFx(sim, { type: 'rescue', playerId: down.id, x: down.x, y: down.y });
        return;
      }
      // E order (docs/product-logic.md 7.4): rescue -> airlock -> repair -> deploy a kit.
      if (dist(a.x, a.y, lander.x, lander.y) > O2.airlockRadius) {
        if (tryStartRepair(sim, a)) return;
        tryDeployKit(sim, a);
        return;
      }
      if (a.carrying.length > 0) {
        const mine = crewStatsOf(sim, a.id);
        for (const s of a.carrying) {
          if (mine) {
            mine.samples++;
            mine.science += s.value;
          }
          lander.cache.push(s);
          sim.hidden.stats.samplesDeposited++;
          if (s.tier !== 'surface') sim.hidden.stats.deepDeposited++;
          sim.hidden.stats.scienceRaw += s.value;
        }
        pushFx(sim, { type: 'deposit', playerId, n: a.carrying.length });
        a.carrying = [];
      }
      // An empty store cannot refill anyone, so the airlock lets the suit in as it is: otherwise
      // the crew dies at the door of a safe hull (every scenario; bot soak, audit).
      const storeEmpty = lander.o2Store < AIRLOCK.emptyStore;
      if (a.o2 < a.o2Max * 0.98 && !storeEmpty) {
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
      if (!canEva || !PING_KINDS.includes(msg.kind)) return;
      // The position matters for SHAKING: a hint for Mission Control (PL 7.11, 7.20).
      const a = findAstronaut(sim, playerId);
      pushFx(sim, { type: 'ping', playerId, s: msg.kind, x: a?.x, y: a?.y });
      pushLog(sim, playerId, `ping.${msg.kind}`);
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
      if (!canMc || !ALERT_KINDS.includes(msg.kind)) return;
      const a = findAstronaut(sim, String(msg.playerId));
      if (!a) return;
      pushFx(sim, { type: 'alert', playerId: a.id, s: msg.kind });
      pushLog(sim, 'mc', `alert.${msg.kind}`, { id: a.id });
      return;
    }
    case 'mc:liftoff': {
      if (canMc && t >= 0) endMission(sim);
      return;
    }
    case 'mc:ration': {
      // RATION shares the store between people (PL 7.4): it does not exist in solo.
      if (canMc && !sim.params.solo) sim.pub.lander.ration = msg.on === true;
      return;
    }
    case 'mc:dispense': {
      if (!canMc) return;
      const a = findAstronaut(sim, String(msg.playerId));
      if (a && a.wantsRefill) a.refillGranted = true;
      return;
    }
    case 'mc:classify': {
      if (
        !canMc ||
        typeof msg.eventId !== 'string' ||
        !['quake', 'impact', 'wind'].includes(msg.kind)
      )
        return;
      const event = sim.pub.seismic.find((e) => e.id === msg.eventId);
      if (event && event.truth === null && t < event.deadline) resolveEvent(sim, event, msg.kind);
      return;
    }
    case 'mc:locate': {
      if (!canMc || typeof msg.eventId !== 'string' || !num(msg.x) || !num(msg.y)) return;
      placePick(sim, msg.eventId.slice(0, 32), clampToWorld(msg.x), clampToWorld(msg.y));
      return;
    }
    default:
      return;
  }
}
