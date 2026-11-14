// Scenario beats and the event director (docs/product-logic.md 5.3, 7.17, 9.1).
// Beats: scripted actions at fixed seconds, each run exactly once (task A1).
// Director acts with event pools arrive in task A5. Free mission has neither.
import { DIRECTOR, LANDER_POS, SEISMIC, WEATHER } from '../balance';
import { createRng } from '../rng';
import type { Rng } from '../rng';
import { SCENARIOS } from '../scenarios';
import type { BeatAction } from '../scenarios';
import { clampToWorld, nearLedge } from '../terrain';
import type { EventKind, Vec2 } from '../types';
import { spawnDevil } from './devils';
import { spawnFault } from './faults';
import { scheduleFlare } from './flare';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

/** Salt of the director RNG stream (docs/architecture.md 6.3). */
const SALT = 0xd17;

/** Stateless per-beat stream: inserting a beat never shifts the randomness of others. */
function beatRng(sim: Sim, index: number): Rng {
  return createRng((sim.params.seed ^ SALT ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
}

function firstActive(sim: Sim): Vec2 {
  const a = sim.pub.astronauts.find((x) => x.status === 'active') ?? sim.pub.astronauts[0];
  return a ? { x: a.x, y: a.y } : { ...LANDER_POS };
}

/** Epicentre for a scripted event (the same placement rules as the director). */
export function placeEvent(
  sim: Sim,
  kind: EventKind,
  near: 'crew' | 'station' | 'lander',
  rng: Rng,
  distance?: number,
): Vec2 {
  if (kind === 'wind' || near === 'station') {
    const stations = sim.pub.stations;
    const s = stations[rng.int(0, Math.max(0, stations.length - 1))];
    return s ? { ...s } : { ...LANDER_POS };
  }
  const centre = near === 'crew' ? firstActive(sim) : LANDER_POS;
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

export const directorSystem: System = (sim) => {
  if (sim.pub.t < 0) return;
  const beats = SCENARIOS[sim.params.scenario].beats;
  const d = sim.hidden.director;
  while (d.beatsDone < beats.length && sim.pub.t >= beats[d.beatsDone]!.at) {
    const index = d.beatsDone++;
    runAction(sim, beats[index]!.action, index);
  }
};
