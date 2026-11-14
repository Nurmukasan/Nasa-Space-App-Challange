// Scenario beats and the event director (docs/product-logic.md 5.3, 7.17, 9.1).
// Beats: scripted actions at fixed seconds, each run exactly once (task A1).
// Director: events from the current act's pool at random gaps, never piling onto a crew member
// in trouble; one third-act crisis (task A5). Free mission has neither.
import { DIRECTOR, FLARE, LANDER_POS, SEISMIC, WEATHER } from '../balance';
import { createRng } from '../rng';
import type { Rng } from '../rng';
import { SCENARIOS } from '../scenarios';
import type { ActDef, BeatAction, DirectorEvent } from '../scenarios';
import { clampToWorld, nearLedge } from '../terrain';
import { SITES } from '../catalog';
import type { EventKind, FaultKind, Vec2 } from '../types';
import { spawnDevil } from './devils';
import { faultActive, spawnFault } from './faults';
import { scheduleFlare } from './flare';
import { signalTrack } from './signal';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

/** Salt of the director RNG stream (docs/architecture.md 6.3). */
const SALT = 0xd17;

/** Stateless per-beat stream: inserting a beat never shifts the randomness of others. */
function beatRng(sim: Sim, index: number): Rng {
  return createRng((sim.params.seed ^ SALT ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
}

/** A fresh stream for each director decision. */
function decisionRng(sim: Sim): Rng {
  const n = sim.hidden.director.decisions++;
  return createRng((sim.params.seed ^ SALT ^ Math.imul(n + 0x10000, 0x85ebca6b)) >>> 0);
}

function firstActive(sim: Sim): Vec2 {
  const a = sim.pub.astronauts.find((x) => x.status === 'active') ?? sim.pub.astronauts[0];
  return a ? { x: a.x, y: a.y } : { ...LANDER_POS };
}

/** Epicentre for a scripted event (the same placement rules as the director). */
export function placeEvent(
  sim: Sim,
  kind: EventKind,
  near: 'crew' | 'station' | 'lander' | Vec2,
  rng: Rng,
  distance?: number,
): Vec2 {
  if (kind === 'wind' || near === 'station') {
    const stations = sim.pub.stations;
    const s = stations[rng.int(0, Math.max(0, stations.length - 1))];
    return s ? { ...s } : { ...LANDER_POS };
  }
  const centre = typeof near === 'object' ? near : near === 'crew' ? firstActive(sim) : LANDER_POS;
  const sites = [...sim.pub.sites, ...sim.hidden.hiddenSites];
  let best: Vec2 = { ...centre };
  for (let attempt = 0; attempt < SEISMIC.epicentreAttempts; attempt++) {
    const angle = rng.range(0, Math.PI * 2);
    const r =
      distance ??
      (kind === 'quake'
        ? rng.range(DIRECTOR.nearCrewMin, DIRECTOR.nearCrewMax)
        : rng.range(SEISMIC.impactMinDist, SEISMIC.impactMaxDist));
    best = {
      x: clampToWorld(centre.x + Math.cos(angle) * r),
      y: clampToWorld(centre.y + Math.sin(angle) * r),
    };
    const ok =
      kind === 'quake'
        ? nearLedge(best.x, best.y, sim.salt, SEISMIC.epicentreLedgeDist)
        : sites.every((s) => dist(best.x, best.y, s.x, s.y) >= SEISMIC.impactSiteClearance);
    if (ok) break;
  }
  return best;
}

function runAction(sim: Sim, action: BeatAction, index: number): void {
  const t = sim.pub.t;
  switch (action.kind) {
    case 'radio':
      pushLog(sim, action.from, action.key);
      return;
    case 'event': {
      const p = placeEvent(sim, action.event, action.near, beatRng(sim, index), action.dist);
      // An impact beat marks the fireball moment; the strike follows the usual lead.
      const t0 = action.event === 'impact' ? t + SEISMIC.fireballLeadS : t;
      sim.hidden.schedule.push({ id: `B${index}`, kind: action.event, t0, ...p, fired: false });
      return;
    }
    case 'flare':
      scheduleFlare(sim, t, action.leadS, action.durS);
      return;
    case 'storm': {
      const lead = sim.params.hasWeather ? WEATHER.forecastWithStationS : WEATHER.forecastWithoutS;
      sim.hidden.storm = { tStart: t + lead, tEnd: t + lead + WEATHER.stormDurS };
      sim.hidden.stormStarted = false;
      sim.hidden.stormEnded = false;
      return;
    }
    case 'fault':
      spawnFault(sim, action.fault);
      return;
    case 'devil':
      spawnDevil(sim, firstActive(sim));
      return;
    case 'act':
      sim.pub.act = action.act;
      sim.hidden.director.act = action.act;
      pushFx(sim, { type: 'act', n: action.act });
      return;
    case 'window':
      sim.hidden.director.windowWarned = true;
      pushFx(sim, { type: 'window_closing', n: Math.round(sim.pub.durationS - t) });
      return;
  }
}

/** Someone is low on oxygen or down: hold non-critical events (docs/product-logic.md 7.17). */
function tense(sim: Sim): boolean {
  return sim.pub.astronauts.some(
    (a) =>
      a.status === 'down' || (a.status === 'active' && a.o2 < a.o2Max * DIRECTOR.tensionO2Frac),
  );
}

function actAt(acts: ActDef[], t: number): number {
  let i = 0;
  while (i + 1 < acts.length && t >= acts[i + 1]!.from) i++;
  return i;
}

function randomActive(sim: Sim, rng: Rng): Vec2 {
  const crew = sim.pub.astronauts.filter((a) => a.status === 'active');
  const a = crew.length > 0 ? crew[rng.int(0, crew.length - 1)]! : null;
  return a ? { x: a.x, y: a.y } : firstActive(sim);
}

function pickFault(sim: Sim, rng: Rng): FaultKind | null {
  const options: FaultKind[] = ['moxie_clog', 'antenna_drift'];
  if (sim.params.hasBattery && sim.pub.t >= sim.params.duskEndS) options.push('battery_fault');
  const free = options.filter((k) => !faultActive(sim, k));
  return free.length > 0 ? free[rng.int(0, free.length - 1)]! : null;
}

function spawnEvent(sim: Sim, kind: DirectorEvent, rng: Rng): void {
  const t = sim.pub.t;
  if (kind === 'devil') return spawnDevil(sim, randomActive(sim, rng));
  if (kind === 'fault') {
    const fault = pickFault(sim, rng);
    if (fault) spawnFault(sim, fault);
    return;
  }
  const near = kind === 'quake' ? randomActive(sim, rng) : kind === 'wind' ? 'station' : 'lander';
  const p = placeEvent(sim, kind, near, rng);
  const t0 = kind === 'impact' ? t + SEISMIC.fireballLeadS : t;
  const id = `D${sim.hidden.director.decisions}`;
  sim.hidden.schedule.push({ id, kind, t0, ...p, fired: false });
}

function crisis(sim: Sim): void {
  const d = sim.hidden.director;
  const t = sim.pub.t;
  if (d.crisis === null) {
    const rng = decisionRng(sim);
    d.crisis = rng.next() < SITES[sim.params.site].stormChance ? 'storm' : 'flare';
    d.crisisAt = rng.range(DIRECTOR.crisisMinS, DIRECTOR.crisisMaxS);
  }
  if (d.crisisDone) return;
  if (d.crisis === 'storm') {
    // Set early enough for the forecast lead, so Mission Control sees it coming.
    const lead = sim.params.hasWeather ? WEATHER.forecastWithStationS : WEATHER.forecastWithoutS;
    if (t < d.crisisAt - lead) return;
    sim.hidden.storm = { tStart: d.crisisAt, tEnd: d.crisisAt + WEATHER.stormDurS };
    sim.hidden.stormStarted = false;
    sim.hidden.stormEnded = false;
  } else {
    if (t < d.crisisAt - FLARE.leadS) return;
    scheduleFlare(sim, t, d.crisisAt - t, FLARE.durS);
    pushLog(sim, 'earth', 'story.signal.flare');
  }
  d.crisisDone = true;
}

function direct(sim: Sim, acts: ActDef[]): void {
  const d = sim.hidden.director;
  const t = sim.pub.t;
  crisis(sim);
  if (d.nextAt === 0) {
    // The first director event is always the tutorial wind.
    d.nextAt = decisionRng(sim).range(DIRECTOR.firstWindMinS, DIRECTOR.firstWindMaxS);
    d.spawned['first'] = 0;
    return;
  }
  if (t < d.nextAt) return;
  if (tense(sim)) {
    d.nextAt = t + DIRECTOR.postponeS;
    return;
  }
  const rng = decisionRng(sim);
  const actIdx = actAt(acts, t);
  const act = acts[actIdx]!;
  d.nextAt = t + rng.range(act.gapS[0], act.gapS[1]);
  if (d.spawned['first'] === 0) {
    d.spawned['first'] = 1;
    return spawnEvent(sim, 'wind', rng);
  }
  // Remaining weight = how many more of each kind this act may still spawn.
  const left: Array<[DirectorEvent, number]> = [];
  for (const kind of ['wind', 'quake', 'impact', 'devil', 'fault'] as DirectorEvent[]) {
    const n = (act.pool[kind] ?? 0) - (d.spawned[`${actIdx}:${kind}`] ?? 0);
    if (n > 0) left.push([kind, n]);
  }
  const total = left.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0) return;
  let roll = rng.range(0, total);
  for (const [kind, n] of left) {
    if ((roll -= n) >= 0) continue;
    d.spawned[`${actIdx}:${kind}`] = (d.spawned[`${actIdx}:${kind}`] ?? 0) + 1;
    return spawnEvent(sim, kind, rng);
  }
}

export const directorSystem: System = (sim) => {
  if (sim.pub.t < 0) return;
  const sc = SCENARIOS[sim.params.scenario];
  const d = sim.hidden.director;
  while (d.beatsDone < sc.beats.length && sim.pub.t >= sc.beats[d.beatsDone]!.at) {
    const index = d.beatsDone++;
    runAction(sim, sc.beats[index]!.action, index);
  }
  if (sc.acts.length > 0) direct(sim, sc.acts);
  if (sc.signal) signalTrack(sim);
};
