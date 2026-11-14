// Simulation container + helpers shared by all systems.
import {
  LANDER_POS,
  LAUNCH_COUNTDOWN_S,
  POWER,
  REPORT,
  SEISMIC,
  STATIONS,
  WEATHER,
} from '../balance';
import { createRng } from '../rng';
import { SITES } from '../catalog';
import { buildSchedule } from './schedule';
import { generateSites } from '../terrain';
import { initDiscovery } from './discovery';
import { initSignal } from './signal';
import { buildObjectives } from './objectives';
import type {
  Astronaut,
  EvaState,
  EventKind,
  FlareState,
  FxEvent,
  FxType,
  Hazard,
  LogEntry,
  MissionParams,
  MissionStats,
  SampleSite,
  TimelineEntry,
  Vec2,
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
  /** The operator's pick was scored (locate statistics). */
  pickScored?: boolean;
  /** RED SIGNAL pulse: own signature, no rockfall, locate only. */
  signal?: boolean;
}

/** Server-only state: never serialized into snapshots. */
export interface SimHidden {
  schedule: ScheduledEvent[];
  stats: MissionStats;
  storm: { tStart: number; tEnd: number } | null;
  stormStarted: boolean;
  stormEnded: boolean;
  pendingRockfalls: Array<Hazard & { hit: boolean }>;
  nextFxId: number;
  nextLogId: number;
  /** Mission time of the last accepted move per astronaut. */
  lastMoveT: Record<string, number>;
  /** Undiscovered sites with exact positions (v2 discovery). */
  hiddenSites: SampleSite[];
  /** RED SIGNAL source, or null outside the signal scenario. */
  signalSource: Vec2 | null;
  /** Full flare plan; pub.flare shows it from warnAt. */
  flare: FlareState | null;
  /** 0 planned, 1 warned, 2 active, 3 over. */
  flarePhase: number;
  director: DirectorState;
  /** Key moments for the report (pushFx records them). */
  timeline: TimelineEntry[];
}

export interface DirectorState {
  act: number;
  /** Next director event time, next RED SIGNAL pulse time. */
  nextAt: number;
  nextPulseAt: number;
  /** Third-act crisis decided on the first director tick, and when it strikes. */
  crisis: 'storm' | 'flare' | null;
  crisisAt: number;
  crisisDone: boolean;
  /** Director decisions so far: seeds a fresh RNG stream per decision. */
  decisions: number;
  /** Beats already run (indices into the scenario beat list). */
  beatsDone: number;
  /** Events spawned per kind in the current act. */
  spawned: Record<string, number>;
  windowWarned: boolean;
}

/** Effect types worth a place on the report timeline (docs/product-logic.md 8.3). */
const TIMELINE_TYPES: ReadonlySet<FxType> = new Set<FxType>([
  'act',
  'deposit',
  'discovery',
  'deploy',
  'tremor',
  'impact',
  'rockfall',
  'breach',
  'down',
  'rescue',
  'lost',
  'fault',
  'repair_done',
  'storm_start',
  'flare_start',
  'signal_located',
  'signal_found',
  'objective_done',
  'window_closing',
  'liftoff',
]);

export interface Sim {
  pub: EvaState;
  hidden: SimHidden;
  params: MissionParams;
  /** Terrain salt of the landing site. */
  salt: number;
}

/** A system mutates the sim for one fixed step. Keep each system in its own file. */
export type System = (sim: Sim, dt: number) => void;

export function emptyStats(crew: number, ids: string[] = []): MissionStats {
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
    discoveries: 0,
    stationsDeployed: 0,
    repairs: 0,
    faultSeconds: 0,
    locatePicks: 0,
    locateGood: 0,
    locateErrorSum: 0,
    sandSeconds: 0,
    devilSeconds: 0,
    doseMax: 0,
    signalRetrieved: false,
    crewStats: ids.map((id) => ({
      id,
      distance: 0,
      science: 0,
      samples: 0,
      rescues: 0,
      repairs: 0,
      discoveries: 0,
      o2Used: 0,
      secondsOutside: 0,
    })),
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
      // Kits are dealt round-robin: crew member i gets every n-th kit.
      kits: Math.floor(params.kits / Math.max(1, n)) + (i < params.kits % Math.max(1, n) ? 1 : 0),
      repairing: null,
      scan: null,
      dose: 0,
    };
  });
  const stations: Vec2[] = [];
  // v2: one lander-mounted station; the crew deploys the rest (docs/product-logic.md 7.7).
  if (params.deployStations)
    stations.push({
      x: LANDER_POS.x + STATIONS.landerOffset.x,
      y: LANDER_POS.y + STATIONS.landerOffset.y,
    });
  else
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
      faults: [],
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
    scenario: params.scenario,
    act: 1,
    objectives: buildObjectives(params),
    anomalies: [],
    devils: [],
    flare: null,
    signal: { zone: null, pulses: 0, located: false, found: false, retrieved: false },
  };
  // Classic schedule and random storm belong to the free mission; v2 scenarios use beats/director.
  const classic = params.scenario === 'free';
  const rng = createRng(params.seed ^ 0x570a);
  const tStart =
    classic && rng.next() < SITES[params.site].stormChance
      ? rng.range(WEATHER.stormEarliestS, WEATHER.stormLatestS)
      : null;
  const sim: Sim = {
    pub,
    hidden: {
      schedule: classic ? buildSchedule(params, SITES[params.site].terrainSalt) : [],
      pendingRockfalls: [],
      storm: tStart === null ? null : { tStart, tEnd: tStart + WEATHER.stormDurS },
      stormStarted: false,
      stormEnded: false,
      stats: emptyStats(n, astronautIds),
      nextFxId: 1,
      nextLogId: 1,
      lastMoveT: {},
      hiddenSites: [],
      signalSource: null,
      flare: null,
      flarePhase: 0,
      director: {
        act: 1,
        nextAt: 0,
        nextPulseAt: 0,
        crisis: null,
        crisisAt: 0,
        crisisDone: false,
        decisions: 0,
        beatsDone: 0,
        spawned: {},
        windowWarned: false,
      },
      timeline: [],
    },
    params,
    salt: SITES[params.site].terrainSalt,
  };
  initDiscovery(sim);
  // After discovery: the source is appended to the hidden sites.
  initSignal(sim);
  return sim;
}

export function pushFx(sim: Sim, fx: Omit<FxEvent, 'id' | 't'>): void {
  sim.pub.fx.push({ id: sim.hidden.nextFxId++, t: sim.pub.t, ...fx });
  const timeline = sim.hidden.timeline;
  if (TIMELINE_TYPES.has(fx.type) && timeline.length < REPORT.timelineMax)
    timeline.push({ t: sim.pub.t, type: fx.type, playerId: fx.playerId, n: fx.n });
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
