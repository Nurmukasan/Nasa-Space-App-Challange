// Decision logic for headless players (docs/phases.md, task A12). Pure: snapshot in, messages out.
// Shared by the socket bots (tools/bots.ts) and the in-process soak (tools/mission-soak.ts).
import {
  DIG,
  FAULTS,
  O2,
  SITES,
  STATIONS,
  TICK_HZ,
  WORLD_PX,
  fieldSpeed,
  portPos,
  returnCost,
  sandAt,
} from '@rs/shared';
import type {
  Astronaut,
  ClientMsg,
  EvaState,
  EventKind,
  MissionParams,
  SeismicEvent,
  Vec2,
} from '@rs/shared';

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
/** Leave the lander only with this share of a tank in the store (one refill). */
const EVA_STORE_MUL = 0.6;

/** Signature reading, as an operator would from the seismograph (PL 7.11). */
export function classifyBySignature(e: SeismicEvent): EventKind {
  const s = e.signals[0];
  if (!s) return 'quake';
  if (s.riseS < 1) return 'impact';
  if (s.pressureDip > 0 || s.noise > 0.2) return 'wind';
  return 'quake';
}

/**
 * Epicentre from the station range rings: least squares over a coarse grid, then refined.
 * With a single station, its bearing and distance give the point directly.
 */
export function pickEpicentre(e: SeismicEvent, stations: Vec2[]): Vec2 | null {
  const rings = e.signals
    .map((s) => ({ at: stations[s.stationIdx], d: s.distEst, b: s.bearingEst }))
    .filter((r): r is { at: Vec2; d: number; b: number | null } => !!r.at && r.d > 0);
  if (rings.length === 0) return null;
  const first = rings[0]!;
  const fromBearing =
    first.b !== null
      ? { x: first.at.x + Math.cos(first.b) * first.d, y: first.at.y + Math.sin(first.b) * first.d }
      : null;
  if (rings.length === 1) return fromBearing;
  const cost = (x: number, y: number) => {
    let c = 0;
    for (const r of rings) c += (Math.hypot(x - r.at.x, y - r.at.y) - r.d) ** 2;
    // The bearing breaks the mirror ambiguity of two rings.
    if (fromBearing) c += 0.02 * ((x - fromBearing.x) ** 2 + (y - fromBearing.y) ** 2);
    return c;
  };
  let best = { x: WORLD_PX / 2, y: WORLD_PX / 2 };
  let bestC = Infinity;
  for (const step of [32, 8, 2]) {
    const span = step === 32 ? WORLD_PX / 2 : step * 6;
    const cx = best.x,
      cy = best.y;
    for (let y = cy - span; y <= cy + span; y += step)
      for (let x = cx - span; x <= cx + span; x += step) {
        if (x < 0 || y < 0 || x > WORLD_PX || y > WORLD_PX) continue;
        const c = cost(x, y);
        if (c < bestC) {
          bestC = c;
          best = { x, y };
        }
      }
  }
  return best;
}

/** Mission Control bot: classify, pick epicentres, dispense oxygen, send crew to fault ports. */
export class McBrain {
  private answered = new Set<string>();
  private picked = new Set<string>();
  private sentToPort = new Map<string, string>();

  decide(s: EvaState, p: MissionParams): ClientMsg[] {
    const out: ClientMsg[] = [];
    for (const e of s.seismic) {
      if (s.t >= e.deadline) continue;
      const heard = Math.max(0, ...e.signals.map((x) => x.delayS)) + 0.5;
      if (s.t < e.t0 + heard) continue;
      if (!this.picked.has(e.id) && p.scenario !== 'free') {
        this.picked.add(e.id);
        const pick = pickEpicentre(e, s.stations);
        if (pick) out.push({ t: 'mc:locate', eventId: e.id, ...pick });
      }
      if (!e.signal && e.guess === null && !this.answered.has(e.id)) {
        this.answered.add(e.id);
        out.push({ t: 'mc:classify', eventId: e.id, kind: classifyBySignature(e) });
      }
    }
    for (const a of s.astronauts)
      if (a.wantsRefill && !a.refillGranted) out.push({ t: 'mc:dispense', playerId: a.id });
    // One astronaut per fault: the nearest active one goes to its port.
    for (const f of s.lander.faults) {
      if (this.sentToPort.get(f.id)) continue;
      const port = portPos(f.port);
      const crew = s.astronauts
        .filter((a) => a.status === 'active' && a.repairing === null)
        .sort((a, b) => dist(a, port) - dist(b, port))[0];
      if (!crew) continue;
      this.sentToPort.set(f.id, crew.id);
      out.push({ t: 'mc:waypoint', playerId: crew.id, x: port.x, y: port.y });
    }
    for (const [faultId, crewId] of this.sentToPort)
      if (!s.lander.faults.some((f) => f.id === faultId)) {
        this.sentToPort.delete(faultId);
        out.push({ t: 'mc:clearWaypoint', playerId: crewId });
      }
    return out;
  }
}

/** Astronaut bot: dig, scout anomalies, deploy kits, repair at ports, shelter, chase the signal. */
export class EvaBrain {
  private returning = false;
  private restUntil = 0;
  constructor(
    private me: string,
    /** Index among the crew: the first astronaut chases RED SIGNAL. */
    private slot: number,
  ) {}

  private move(s: EvaState, p: MissionParams, a: Astronaut, to: Vec2): ClientMsg {
    const d = dist(a, to);
    const ang = Math.atan2(to.y - a.y, to.x - a.x);
    const step = Math.min(d, fieldSpeed(p, s, a.x, a.y, false, a.crewClass) / TICK_HZ);
    return {
      t: 'eva:move',
      x: a.x + Math.cos(ang) * step,
      y: a.y + Math.sin(ang) * step,
      facing: ang,
      moving: step > 0,
      running: false,
    };
  }
  private stop(a: Astronaut): ClientMsg {
    return { t: 'eva:move', x: a.x, y: a.y, facing: a.facing, moving: false, running: false };
  }

  decide(s: EvaState, p: MissionParams): ClientMsg[] {
    const a = s.astronauts.find((x) => x.id === this.me);
    if (!a || a.status === 'lost' || a.status === 'down' || s.t < 0) return [];
    const flare = s.flare && s.t >= s.flare.warnAt && s.t < s.flare.tEnd ? s.flare : null;
    const late = s.t > s.durationS - 45;
    if (a.status === 'inside') {
      const work = s.sites.some((x) => x.depth < p.maxDepth) || s.anomalies.length > 0;
      // With an empty store the airlock cannot refill anyone, and E will not let a part-full
      // suit back in: only go out with enough in the store for one refill.
      const store = s.lander.o2Store >= a.o2Max * EVA_STORE_MUL;
      return !flare && !late && store && s.t >= this.restUntil && work
        ? [{ t: 'eva:interact' }]
        : [];
    }
    // Rescue a downed crewmate first.
    const down = s.astronauts.find((b) => b.status === 'down' && b.id !== a.id);
    if (down && a.o2 > O2.shareAmount + O2.shareReserve + returnCost(p, s.weather, a.x, a.y)) {
      if (dist(a, down) <= O2.shareRange - 2) return [this.stop(a), { t: 'eva:interact' }];
      return [this.move(s, p, a, down)];
    }
    // Repair: Mission Control's waypoint on a faulted port.
    if (a.repairing) return [this.stop(a)];
    const fault = s.lander.faults.find((f) => a.waypoint && dist(a.waypoint, portPos(f.port)) < 1);
    if (fault && !flare && a.o2 > returnCost(p, s.weather, a.x, a.y) + 15) {
      const port = portPos(fault.port);
      // Stand just outside the port, beyond the airlock radius.
      const k = (FAULTS.portDist + 6) / FAULTS.portDist;
      const spot = {
        x: s.lander.x + (port.x - s.lander.x) * k,
        y: s.lander.y + (port.y - s.lander.y) * k,
      };
      if (dist(a, spot) < 3) return [this.stop(a), { t: 'eva:interact' }];
      return [{ t: 'eva:dig', on: false }, this.move(s, p, a, spot)];
    }
    const signalSample = a.carrying.some((x) => x.kind === 'signal' && x.tier !== 'surface');
    if (
      flare ||
      late ||
      signalSample ||
      a.o2 < returnCost(p, s.weather, a.x, a.y) + 12 ||
      a.carrying.length >= p.carryCap
    )
      this.returning = true;
    if (this.returning) {
      if (dist(a, s.lander) < O2.airlockRadius - 2) {
        const out: ClientMsg[] = [{ t: 'eva:dig', on: false }, this.stop(a), { t: 'eva:interact' }];
        if (a.o2 >= a.o2Max * 0.98 && a.carrying.length === 0) {
          this.returning = false;
          const rate = p.moxieRate * s.lander.power.eff.moxie;
          // Let MOXIE refill the store a little before heading out again.
          this.restUntil = flare ? flare.tEnd : s.t + (rate > 0 ? Math.min(30, 60 / rate) : 30);
        }
        return out;
      }
      return [{ t: 'eva:dig', on: false }, this.move(s, p, a, s.lander)];
    }
    // Deploy a kit as soon as the spot is legal (the server re-checks).
    const fromLander = dist(a, s.lander);
    if (
      a.kits > 0 &&
      fromLander >= STATIONS.minFromLander + 4 &&
      s.stations.every((st) => dist(a, st) >= STATIONS.minBetween + 4) &&
      !sandAt(a.x, a.y, SITES[p.site].terrainSalt)
    )
      return [{ t: 'eva:interact' }];
    const target = this.target(s, p, a);
    if (!target) {
      this.returning = true;
      return [this.move(s, p, a, s.lander)];
    }
    if ('depth' in target && dist(a, target) < DIG.reach)
      return [this.stop(a), { t: 'eva:dig', on: true }];
    return [{ t: 'eva:dig', on: false }, this.move(s, p, a, target)];
  }

  private target(
    s: EvaState,
    p: MissionParams,
    a: Astronaut,
  ): Vec2 | (Vec2 & { depth: number }) | null {
    const sig = s.signal;
    const source = s.sites.find((x) => x.kind === 'signal');
    // The signal chaser: zone, then scanner, then dig the source deep.
    if (this.slot === 0 && sig.located && !sig.retrieved) {
      if (source && source.depth < p.maxDepth) return source;
      if (a.scan)
        return { x: a.x + Math.cos(a.scan.bearing) * 40, y: a.y + Math.sin(a.scan.bearing) * 40 };
      if (sig.zone) return sig.zone;
    }
    const live = s.sites.filter(
      (x) =>
        x.kind !== 'signal' && (x.expiresAt === null || x.expiresAt > s.t) && x.depth < p.maxDepth,
    );
    const site = live.sort((x, y) => dist(a, x) - dist(a, y))[0];
    if (a.scan && (!site || dist(a, site) > 120))
      return { x: a.x + Math.cos(a.scan.bearing) * 40, y: a.y + Math.sin(a.scan.bearing) * 40 };
    if (site) return site;
    const anomaly = [...s.anomalies].sort((x, y) => dist(a, x) - dist(a, y))[0];
    return anomaly ?? null;
  }
}
