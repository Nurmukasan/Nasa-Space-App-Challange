// Astronaut bot (docs/phases.md, task A12; big world v2.1). Pure: snapshot in, messages out.
// Digs and scouts, deploys kits, repairs at ports, shelters from flares, rescues, chases the
// RED SIGNAL; in the big world it also drives the rover, refills at supply caches and slides
// along lava-tube walls instead of walking into them.
import {
  CACHES,
  DIG,
  FAULTS,
  O2,
  ROVER,
  SITES,
  STATIONS,
  TICK_HZ,
  fieldSpeed,
  inCave,
  portPos,
  returnCost,
  roverBlockedAt,
  roverSpeed,
  sandAt,
  slideMove,
  DIG_GAME,
  digGameOn,
  digMarker,
} from '@rs/shared';
import type { Astronaut, ClientMsg, EvaState, MissionParams, Vec2 } from '@rs/shared';

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
/** Leave the lander only with this share of a tank in the store (one refill). */
const EVA_STORE_MUL = 0.6;
/** Take the rover for targets farther than this, px. */
const DRIVE_FROM = 650;
/** Stop the rover this far short of a site and walk the rest, px. */
const DRIVE_SHORT = 45;
/** After leaving a blocked rover, walk this long before boarding again, s. */
const NO_BOARD_S = 25;
/** Spare seconds when deciding to head home before the window closes. */
const HOME_SPARE_S = 30;
const STUCK_CHECK_S = 2;
const STUCK_PX = 8;

/** Bots strike inside this fraction of the GOOD zone: steady, not perfect. */
const BOT_AIM = 0.6;

export class EvaBrain {
  private returning = false;
  private restUntil = 0;
  private driveTo: Vec2 | null = null;
  private noBoardUntil = 0;
  private lastPos: Vec2 | null = null;
  private lastCheck = 0;
  private detourUntil = 0;
  private detour = 0;
  constructor(
    private me: string,
    /** Index among the crew: the first astronaut chases RED SIGNAL. */
    private slot: number,
  ) {}

  private salt(p: MissionParams): number {
    return SITES[p.site].terrainSalt;
  }

  /** One tick toward `to`, sliding along walls and detouring when stuck. */
  private move(s: EvaState, p: MissionParams, a: Astronaut, to: Vec2): ClientMsg {
    const speed = a.inRover
      ? roverSpeed(p, s, a.x, a.y)
      : fieldSpeed(p, s, a.x, a.y, false, a.crewClass);
    const d = dist(a, to);
    const step = Math.min(d, speed / TICK_HZ);
    const base = Math.atan2(to.y - a.y, to.x - a.x) + (s.t < this.detourUntil ? this.detour : 0);
    let end: Vec2 = { x: a.x, y: a.y };
    let facing = base;
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const ang = base + turn;
      end = slideMove(
        a.x,
        a.y,
        a.x + Math.cos(ang) * step,
        a.y + Math.sin(ang) * step,
        this.salt(p),
        a.inRover,
      );
      facing = ang;
      if (dist(end, a) >= step * 0.5) break;
    }
    if (s.t - this.lastCheck >= STUCK_CHECK_S) {
      if (this.lastPos && dist(this.lastPos, a) < STUCK_PX && d > STUCK_PX * 2) {
        this.detour = (Math.floor(s.t) % 2 === 0 ? 1 : -1) * (Math.PI / 2);
        this.detourUntil = s.t + STUCK_CHECK_S;
      }
      this.lastPos = { x: a.x, y: a.y };
      this.lastCheck = s.t;
    }
    return { t: 'eva:move', x: end.x, y: end.y, facing, moving: step > 0, running: false };
  }
  private stop(a: Astronaut): ClientMsg {
    return { t: 'eva:move', x: a.x, y: a.y, facing: a.facing, moving: false, running: false };
  }

  /** Seconds to get home from here: by rover if we are in it, else on foot. */
  private homeSeconds(s: EvaState, p: MissionParams, a: Astronaut): number {
    const speed = a.inRover ? ROVER.speed * ROVER.sandMul : p.walkSpeed;
    return dist(a, s.lander) / speed;
  }

  decide(s: EvaState, p: MissionParams): ClientMsg[] {
    const a = s.astronauts.find((x) => x.id === this.me);
    if (!a || a.status === 'lost' || a.status === 'down' || s.t < 0) return [];
    const flare = s.flare && s.t >= s.flare.warnAt && s.t < s.flare.tEnd ? s.flare : null;
    const late = s.t > s.durationS - this.homeSeconds(s, p, a) - HOME_SPARE_S;
    const rover = s.rover;
    if (a.status === 'inside') {
      const work = s.sites.some((x) => x.depth < p.maxDepth) || s.anomalies.length > 0;
      // With an empty store the airlock cannot refill anyone: only go out with one refill there.
      const store = s.lander.o2Store >= a.o2Max * EVA_STORE_MUL;
      return !flare && !late && store && s.t >= this.restUntil && work
        ? [{ t: 'eva:interact' }]
        : [];
    }
    if (a.inRover) return this.drive(s, p, a, flare !== null, late);
    // Flare: the rover cabin is shelter too, if it is closer than the lander.
    if (flare && rover && rover.driver === null && dist(a, rover) < dist(a, s.lander)) {
      this.driveTo = null;
      return this.boardOrWalk(s, p, a);
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
      const k = (FAULTS.portDist + 6) / FAULTS.portDist;
      const spot = {
        x: s.lander.x + (port.x - s.lander.x) * k,
        y: s.lander.y + (port.y - s.lander.y) * k,
      };
      if (dist(a, spot) < 3) return [this.stop(a), { t: 'eva:interact' }];
      return [{ t: 'eva:dig', on: false }, this.move(s, p, a, spot)];
    }
    // Oxygen: head for the cheapest refuge (lander, a stocked cache, the parked rover) in time.
    const refuge = this.refuge(s, p, a);
    if (!flare && !late && refuge.kind !== 'lander' && a.o2 < refuge.cost + 12) {
      if (refuge.kind === 'cache') {
        if (dist(a, refuge.at) <= CACHES.useDist - 4)
          return [{ t: 'eva:dig', on: false }, this.stop(a), { t: 'eva:interact' }];
        return [{ t: 'eva:dig', on: false }, this.move(s, p, a, refuge.at)];
      }
      // The rover's cabin: get in and drive home on the battery.
      this.returning = true;
      this.driveTo = null;
      return this.boardOrWalk(s, p, a);
    }
    const signalSample = a.carrying.some((x) => x.kind === 'signal' && x.tier !== 'surface');
    if (
      flare ||
      late ||
      signalSample ||
      (refuge.kind === 'lander' && a.o2 < refuge.cost + 12) ||
      a.carrying.length >= p.carryCap
    )
      this.returning = true;
    if (this.returning) return this.goHome(s, p, a, flare !== null);
    // Deploy a kit as soon as the spot is legal (the server re-checks). In the big world the
    // chaser keeps its last kit for the signal zone.
    const keepKit = p.bigWorld && this.slot === 0 && a.kits <= 1 && !s.signal.located;
    const byZone = !!s.signal.zone && dist(a, s.signal.zone) < Math.max(250, s.signal.zone.r * 0.6);
    // E next to the parked rover would board it: step away first (the HUD says the same).
    const byRover = !!rover && rover.driver === null && dist(a, rover) <= ROVER.boardDist + 6;
    if (
      a.kits > 0 &&
      !byRover &&
      (!keepKit || byZone) &&
      dist(a, s.lander) >= STATIONS.minFromLander + 4 &&
      s.stations.every((st) => dist(a, st) >= STATIONS.minBetween + 4) &&
      !sandAt(a.x, a.y, this.salt(p), p.bigWorld)
    )
      return [{ t: 'eva:interact' }];
    const target = this.target(s, p, a);
    if (!target) {
      this.returning = true;
      return [this.move(s, p, a, s.lander)];
    }
    // Far away: take the rover if it is parked near us.
    if (
      rover &&
      rover.driver === null &&
      rover.charge > 0.3 &&
      s.t >= this.noBoardUntil &&
      dist(a, target) > DRIVE_FROM &&
      dist(a, rover) < 160
    ) {
      const k = Math.max(0, dist(rover, target) - DRIVE_SHORT) / Math.max(1, dist(rover, target));
      this.driveTo = {
        x: rover.x + (target.x - rover.x) * k,
        y: rover.y + (target.y - rover.y) * k,
      };
      return this.boardOrWalk(s, p, a);
    }
    if ('depth' in target && dist(a, target) < DIG.reach) return this.dig(s, p, a);
    return [{ t: 'eva:dig', on: false }, this.move(s, p, a, target)];
  }

  /** Hold SPACE in Free; in the mini-game strike when the marker is well inside the zone. */
  private dig(s: EvaState, p: MissionParams, a: Astronaut): ClientMsg[] {
    if (!digGameOn(p)) return [this.stop(a), { t: 'eva:dig', on: true }];
    const dig = a.dig;
    if (!dig) return [this.stop(a), { t: 'eva:strike', phase: 0 }];
    const phase = digMarker(dig, s.t);
    if (s.t >= dig.lockUntil && Math.abs(phase - dig.zone) <= DIG_GAME.goodHalf * BOT_AIM)
      return [this.stop(a), { t: 'eva:strike', phase }];
    return [this.stop(a)];
  }

  private boardOrWalk(s: EvaState, p: MissionParams, a: Astronaut): ClientMsg[] {
    const rover = s.rover!;
    if (dist(a, rover) <= ROVER.boardDist - 4) return [this.stop(a), { t: 'eva:interact' }];
    return [{ t: 'eva:dig', on: false }, this.move(s, p, a, rover)];
  }

  private drive(
    s: EvaState,
    p: MissionParams,
    a: Astronaut,
    flare: boolean,
    late: boolean,
  ): ClientMsg[] {
    // Sit the flare out in the shielded cabin.
    if (flare) return [this.stop(a)];
    const dock = { x: s.lander.x + ROVER.parkOffset.x, y: s.lander.y + ROVER.parkOffset.y };
    const dest = late || this.returning || !this.driveTo ? dock : this.driveTo;
    const rover = s.rover!;
    const exit = (): ClientMsg[] => {
      this.driveTo = null;
      // Walk from here for a while instead of hopping straight back in.
      this.noBoardUntil = s.t + NO_BOARD_S;
      return [this.stop(a), { t: 'eva:interact' }];
    };
    // Nowhere to go (no target and not heading home), there, or flat battery: get out.
    if ((!this.driveTo && !this.returning && !late) || dist(a, dest) < 20 || rover.charge <= 0.01)
      return exit();
    // Steer around tube rims: the first heading that still closes on the destination.
    const base = Math.atan2(dest.y - a.y, dest.x - a.x);
    const step = Math.min(dist(a, dest), roverSpeed(p, s, a.x, a.y) / TICK_HZ);
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.4, -1.4]) {
      const ang = base + turn;
      const end = slideMove(
        a.x,
        a.y,
        a.x + Math.cos(ang) * step,
        a.y + Math.sin(ang) * step,
        this.salt(p),
        true,
      );
      if (dist(end, a) >= step * 0.6 && dist(end, dest) < dist(a, dest) - step * 0.1)
        return [{ t: 'eva:move', x: end.x, y: end.y, facing: ang, moving: true, running: false }];
    }
    return exit();
  }

  private goHome(s: EvaState, p: MissionParams, a: Astronaut, flare: boolean): ClientMsg[] {
    const rover = s.rover;
    if (dist(a, s.lander) < O2.airlockRadius - 2) {
      const out: ClientMsg[] = [{ t: 'eva:dig', on: false }, this.stop(a), { t: 'eva:interact' }];
      if (a.o2 >= a.o2Max * 0.98 && a.carrying.length === 0) {
        this.returning = false;
        const rate = p.moxieRate * s.lander.power.eff.moxie;
        // Let MOXIE refill the store a little before heading out again.
        this.restUntil =
          s.flare && flare ? s.flare.tEnd : s.t + (rate > 0 ? Math.min(30, 60 / rate) : 30);
      }
      return out;
    }
    // A long walk home: drive if the rover is on the way.
    if (
      rover &&
      rover.driver === null &&
      rover.charge > 0.05 &&
      dist(a, s.lander) > DRIVE_FROM &&
      dist(a, rover) < Math.min(600, dist(a, s.lander) * 0.6)
    ) {
      this.driveTo = null;
      return this.boardOrWalk(s, p, a);
    }
    return [{ t: 'eva:dig', on: false }, this.move(s, p, a, s.lander)];
  }

  /** Cheapest place to breathe again, with the walking O2 cost to reach it. */
  private refuge(
    s: EvaState,
    p: MissionParams,
    a: Astronaut,
  ): { kind: 'lander' | 'cache' | 'rover'; at: Vec2; cost: number } {
    const walk = (to: Vec2) => (dist(a, to) / p.walkSpeed) * O2.walk * 1.15 + 5;
    let best: { kind: 'lander' | 'cache' | 'rover'; at: Vec2; cost: number } = {
      kind: 'lander',
      at: s.lander,
      cost: returnCost(p, s.weather, a.x, a.y),
    };
    // A cache only helps a suit that is not already nearly full.
    if (a.o2 < a.o2Max * 0.9)
      for (const c of s.caches)
        if (c.o2 >= 10 && walk(c) < best.cost) best = { kind: 'cache', at: c, cost: walk(c) };
    // A rover out in the field is a pressurized ride home; docked by the lander it is not.
    const rover = s.rover;
    if (
      rover &&
      rover.driver === null &&
      rover.charge > 0.15 &&
      dist(rover, s.lander) > 300 &&
      walk(rover) < best.cost
    )
      best = { kind: 'rover', at: rover, cost: walk(rover) };
    return best;
  }

  private target(
    s: EvaState,
    p: MissionParams,
    a: Astronaut,
  ): Vec2 | (Vec2 & { depth: number }) | null {
    const salt = this.salt(p);
    const sig = s.signal;
    const source = s.sites.find((x) => x.kind === 'signal');
    // The signal chaser: zone, then scanner, then dig the source deep.
    if (this.slot === 0 && sig.located && !sig.retrieved) {
      if (source && source.depth < p.maxDepth) return source;
      // Walk into the zone first; there the scanner points at the source itself.
      if (sig.zone && dist(a, sig.zone) > sig.zone.r * 0.5) return sig.zone;
      if (a.scan)
        return { x: a.x + Math.cos(a.scan.bearing) * 40, y: a.y + Math.sin(a.scan.bearing) * 40 };
      if (sig.zone) return sig.zone;
    }
    // The hunt in the big world: carry the last kit out and plant it by the zone, where its
    // range ring is sharp (ring error grows with distance from a station).
    if (this.slot === 0 && p.bigWorld && a.kits > 0 && sig.zone && !sig.located)
      return { x: sig.zone.x, y: sig.zone.y };
    // Bots skip the lava tubes (their skylights need a human eye).
    const live = s.sites.filter(
      (x) =>
        x.kind !== 'signal' &&
        !inCave(x.x, x.y, salt) &&
        (x.expiresAt === null || x.expiresAt > s.t) &&
        x.depth < p.maxDepth,
    );
    const site = live.sort((x, y) => dist(a, x) - dist(a, y))[0];
    if (a.scan && (!site || dist(a, site) > 120) && !inCave(a.x, a.y, salt)) {
      const ahead = {
        x: a.x + Math.cos(a.scan.bearing) * 40,
        y: a.y + Math.sin(a.scan.bearing) * 40,
      };
      if (!roverBlockedAt(ahead.x, ahead.y, salt)) return ahead;
    }
    if (site) return site;
    const anomaly = [...s.anomalies]
      .filter((x) => !x.id.startsWith('C'))
      .sort((x, y) => dist(a, x) - dist(a, y))[0];
    return anomaly ?? null;
  }
}
