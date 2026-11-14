// Simulation container + helpers shared by all systems.
import { LANDER_POS, LAUNCH_COUNTDOWN_S, POWER, SEISMIC } from '../balance';
import { SITES } from '../catalog';
import { buildSchedule } from './schedule';
import { generateSites } from '../terrain';
import type {
  Astronaut,
  EvaState,
  EventKind,
  FxEvent,
  LogEntry,
  MissionParams,
  MissionStats,
} from '../types';

/** Truth about a scheduled event. Never sent to clients. */
export interface ScheduledEvent {
  id: string;
  kind: EventKind;
  t0: number;
  x: number;
  y: number;
  fired: boolean;
  fireballShown?: boolean;
}

/** Server-only state: never serialized into snapshots. */
export interface SimHidden {
  schedule: ScheduledEvent[];
  stats: MissionStats;
  nextFxId: number;
  nextLogId: number;
  /** Mission time of the last accepted move per astronaut. */
  lastMoveT: Record<string, number>;
}

export interface Sim {
  pub: EvaState;
  hidden: SimHidden;
  params: MissionParams;
  /** Terrain salt of the landing site. */
  salt: number;
}

/** A system mutates the sim for one fixed step. Keep each system in its own file. */
export type System = (sim: Sim, dt: number) => void;

export function emptyStats(crew: number): MissionStats {
  return {
    samplesDeposited: 0,
    deepDeposited: 0,
    scienceRaw: 0,
    refills: 0,
    o2Dispensed: 0,
    o2Shared: 0,
    breaches: 0,
    downs: 0,
    lost: 0,
    crew,
    classifyCorrect: 0,
    classifyWrong: 0,
    classifyMissed: 0,
    falseAlarms: 0,
    distanceWalked: 0,
    distanceRun: 0,
    secondsOutside: 0,
    endedAtS: 0,
    allAboard: false,
    o2StoreLeft: 0,
  };
}

export function createSim(params: MissionParams, astronautIds: string[]): Sim {
  const n = astronautIds.length;
  const astronauts: Astronaut[] = astronautIds.map((id, i) => {
    const ang = (i / Math.max(1, n)) * Math.PI * 2 + Math.PI / 2;
    return {
      id,
      x: LANDER_POS.x + Math.cos(ang) * 22,
      y: LANDER_POS.y + Math.sin(ang) * 22,
      facing: ang,
      moving: false,
      running: false,
      digging: false,
      o2: params.tankCapacity,
      o2Max: params.tankCapacity,
      status: 'active',
      leak: false,
      linked: true,
      carrying: [],
      waypoint: null,
      dangerUntil: 0,
      downUntil: 0,
      wantsRefill: false,
      refillGranted: false,
    };
  });
  const stations = [];
  for (let i = 0; i < params.stations; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    stations.push({
      x: Math.round(LANDER_POS.x + Math.cos(ang) * SEISMIC.stationDist),
      y: Math.round(LANDER_POS.y + Math.sin(ang) * SEISMIC.stationDist),
    });
  }
  const pub: EvaState = {
    t: -LAUNCH_COUNTDOWN_S,
    durationS: params.durationS,
    tick: 0,
    astronauts,
    lander: {
      x: LANDER_POS.x,
      y: LANDER_POS.y,
      o2Store: params.o2StoreInit,
      o2StoreMax: params.o2StoreMax,
      ration: false,
      cache: [],
      power: { availW: 0, alloc: { ...POWER.defaultAlloc }, eff: { moxie: 1, comms: 1, scan: 1 } },
    },
    sites: generateSites(params),
    stations,
    seismic: [],
    hazards: [],
    weather: { light: 1, solarFactor: 1, storm: null, stormForecastAt: null },
    relay: { open: false, nextChangeAt: 0 },
    fx: [],
    log: [],
    ended: false,
  };
  return {
    pub,
    hidden: {
      schedule: buildSchedule(params, SITES[params.site].terrainSalt),
      stats: emptyStats(n),
      nextFxId: 1,
      nextLogId: 1,
      lastMoveT: {},
    },
    params,
    salt: SITES[params.site].terrainSalt,
  };
}

export function pushFx(sim: Sim, fx: Omit<FxEvent, 'id' | 't'>): void {
  sim.pub.fx.push({ id: sim.hidden.nextFxId++, t: sim.pub.t, ...fx });
}

export function pushLog(sim: Sim, from: string, key: string, params?: LogEntry['params']): void {
  sim.pub.log.push({ id: sim.hidden.nextLogId++, t: sim.pub.t, from, key, params });
  if (sim.pub.log.length > 20) sim.pub.log.splice(0, sim.pub.log.length - 20);
}

export function findAstronaut(sim: Sim, id: string): Astronaut | undefined {
  return sim.pub.astronauts.find((a) => a.id === id);
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
