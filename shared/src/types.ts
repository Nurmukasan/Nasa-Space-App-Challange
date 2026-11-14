// =============================================================================
// CONTRACT FILE. Shapes of everything that crosses the network or is shared
// between engine, server and client. Change only through a dedicated
// "contract PR" (see docs/architecture.md, section "Hot files").
// =============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

// ----- Room / lobby ----------------------------------------------------------

export type Phase = 'lobby' | 'design' | 'eva' | 'report';

/** mc = Mission Control operator, eva = field astronaut, solo = one player doing both. */
export type Role = 'mc' | 'eva' | 'solo';

export interface PlayerInfo {
  id: string;
  name: string;
  /** Index into PLAYER_COLORS. */
  colorIdx: number;
  role: Role | null;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

// ----- Mission design --------------------------------------------------------

export type ObjectiveId = 'astrobiology' | 'ice' | 'geophysics';
export type SiteId = 'jezero' | 'elysium' | 'arcadia';
export type VehicleId = 'medium' | 'heavy' | 'superheavy';
export type RelayId = 'none' | 'low_orbit' | 'areostationary';
export type DifficultyId = 'cadet' | 'flight' | 'commander';
export type ModuleGroup = 'power' | 'life' | 'tools' | 'science' | 'comms';
export type ModuleId =
  | 'solar'
  | 'rtg'
  | 'battery'
  | 'moxie_s'
  | 'moxie_l'
  | 'o2_reserve'
  | 'tanks_xl'
  | 'drill'
  | 'seismo_net'
  | 'weather'
  | 'gpr'
  | 'antenna_hg';
export type PresetId = 'balanced' | 'budget' | 'science';
export type DesignField = 'objective' | 'site' | 'vehicle' | 'relay' | 'difficulty';

export interface MissionDesign {
  objective: ObjectiveId;
  site: SiteId;
  vehicle: VehicleId;
  relay: RelayId;
  difficulty: DifficultyId;
  modules: ModuleId[];
}

export type DesignIssueCode =
  | 'over_budget'
  | 'over_mass'
  | 'over_bays'
  | 'no_power'
  | 'no_moxie'
  | 'both_moxie'
  | 'power_deficit'
  | 'night_power'
  | 'vehicle_orbit'
  | 'data_bottleneck'
  | 'no_deep_tool'
  | 'no_seismo_net';

export interface DesignIssue {
  code: DesignIssueCode;
  /** error blocks launch, warning does not. */
  severity: 'error' | 'warning';
  params?: Record<string, number | string>;
}

export interface DesignTotals {
  cost: number;
  budget: number;
  massKg: number;
  massCapKg: number;
  baysUsed: number;
  baysMax: number;
  powerGenW: number;
  powerUseW: number;
  /** Science data produced by instruments vs. what the comms link can carry (Mb per sol). */
  dataGen: number;
  dataCap: number;
}

/** What the "Predicted performance" tiles show on the design screen. */
export interface Prediction {
  evaSecondsPerTank: number;
  deepDigSeconds: number;
  refillSeconds: number;
  quakeIdPct: number;
  commsRangeM: number;
  nightPowerPct: number;
  walkSpeedPct: number;
}

export interface DesignCheck {
  ok: boolean;
  totals: DesignTotals;
  issues: DesignIssue[];
  prediction: Prediction;
}

/** Everything the simulation needs. Derived from MissionDesign by deriveParams(). */
export interface MissionParams {
  seed: number;
  objective: ObjectiveId;
  site: SiteId;
  difficulty: DifficultyId;
  durationS: number;
  quota: number;
  deepQuota: number;
  favoredKind: SiteKind;
  tankCapacity: number;
  walkSpeed: number;
  runSpeed: number;
  /** Metres per second of digging. */
  digRate: number;
  /** 1.0 with shovels, 2.0 with the drill. */
  maxDepth: number;
  carryCap: number;
  o2StoreInit: number;
  o2StoreMax: number;
  /** O2 units per second at 100% efficiency. */
  moxieRate: number;
  moxieNeedW: number;
  commsNeedW: number;
  scanNeedW: number;
  baseLoadW: number;
  solarPeakW: number;
  rtgW: number;
  hasBattery: boolean;
  /** Telemetry range in px at 100% comms efficiency. */
  commsRange: number;
  relay: RelayId;
  relayRangeMul: number;
  relayPassPeriodS: number;
  relayPassWindowS: number;
  /** 1 or 3 seismic stations. */
  stations: number;
  hasWeather: boolean;
  hasGpr: boolean;
  dataFactor: number;
  classifyWindowS: number;
}

// ----- EVA (the real-time phase) --------------------------------------------

export type SiteKind = 'delta' | 'crater' | 'basalt' | 'impact';
export type SampleTier = 'surface' | 'deep' | 'core';

export interface Sample {
  siteId: string;
  kind: SiteKind;
  tier: SampleTier;
  value: number;
  /** playerId who collected it. */
  by: string;
}

export interface SampleSite {
  id: string;
  x: number;
  y: number;
  kind: SiteKind;
  richness: 1 | 2 | 3;
  /** Metres dug so far. Persistent and shared between astronauts. */
  depth: number;
  taken: SampleTier[];
  /** Mission time when the site disappears (fresh ice sublimates), or null. */
  expiresAt: number | null;
  /** Shown on the Mission Control map. */
  known: boolean;
}

export type AstroStatus = 'active' | 'inside' | 'down' | 'lost';

export interface Astronaut {
  /** Same as PlayerInfo.id. */
  id: string;
  x: number;
  y: number;
  /** Radians, 0 = +x. */
  facing: number;
  moving: boolean;
  running: boolean;
  digging: boolean;
  o2: number;
  o2Max: number;
  status: AstroStatus;
  leak: boolean;
  /** Telemetry link to the lander is up. */
  linked: boolean;
  carrying: Sample[];
  waypoint: Vec2 | null;
  /** Danger overlay is shown while t < dangerUntil. */
  dangerUntil: number;
  /** When status is 'down': mission time at which the astronaut is lost. */
  downUntil: number;
  /** Asked for oxygen at the airlock. */
  wantsRefill: boolean;
  /** In RATION mode: Mission Control approved the request. */
  refillGranted: boolean;
}

/** Fractions that must sum to 1. */
export interface PowerAlloc {
  moxie: number;
  comms: number;
  scan: number;
}

export interface PowerState {
  availW: number;
  alloc: PowerAlloc;
  /** 0..1 efficiency of each subsystem after allocation. */
  eff: PowerAlloc;
}

export interface LanderState {
  x: number;
  y: number;
  o2Store: number;
  o2StoreMax: number;
  /** RATION mode: refills need Mission Control approval (mc:dispense). */
  ration: boolean;
  cache: Sample[];
  power: PowerState;
}

export type EventKind = 'quake' | 'impact' | 'wind';

/** How one station "hears" an event. The client draws the seismogram from this. */
export interface StationSignal {
  stationIdx: number;
  delayS: number;
  amp: number;
  riseS: number;
  decayS: number;
  freqHz: number;
  noise: number;
  /** 0..1, only non-zero for wind when the weather station is installed. */
  pressureDip: number;
}

export interface SeismicEvent {
  id: string;
  t0: number;
  deadline: number;
  signals: StationSignal[];
  guess: EventKind | null;
  /** null until resolved (deadline passed or operator answered). */
  truth: EventKind | null;
  /** Estimated epicentre with uncertainty radius, null with a single station. */
  estimate: { x: number; y: number; r: number } | null;
}

export interface Hazard {
  id: string;
  kind: 'rockfall';
  x: number;
  y: number;
  r: number;
  /** Mission time when it hits. */
  tHit: number;
  /** True if the operator classified in time, so the crew sees the zone. */
  warned: boolean;
}

export interface WeatherState {
  /** 1 = full daylight, ~0.12 = night. */
  light: number;
  solarFactor: number;
  storm: { tStart: number; tEnd: number } | null;
  /** Mission time from which the forecast is visible to MC, or null. */
  stormForecastAt: number | null;
}

export interface RelayState {
  open: boolean;
  nextChangeAt: number;
}

export type FxType =
  | 'tremor'
  | 'rockfall'
  | 'fireball'
  | 'impact'
  | 'sample'
  | 'deposit'
  | 'refill'
  | 'breach'
  | 'down'
  | 'rescue'
  | 'lost'
  | 'storm_start'
  | 'storm_end'
  | 'classify_ok'
  | 'classify_bad'
  | 'ping'
  | 'alert';

/** One-shot effect. Clients play each id once (dedupe by id). */
export interface FxEvent {
  id: number;
  t: number;
  type: FxType;
  x?: number;
  y?: number;
  playerId?: string;
  n?: number;
  s?: string;
}

export interface LogEntry {
  id: number;
  t: number;
  /** playerId, 'mc' or 'sys'. */
  from: string;
  /** i18n key, e.g. 'log.sample_collected'. */
  key: string;
  params?: Record<string, string | number>;
}

export interface EvaState {
  /** Mission time in seconds. Starts negative (launch countdown). */
  t: number;
  durationS: number;
  tick: number;
  astronauts: Astronaut[];
  lander: LanderState;
  sites: SampleSite[];
  stations: Vec2[];
  seismic: SeismicEvent[];
  hazards: Hazard[];
  weather: WeatherState;
  relay: RelayState;
  fx: FxEvent[];
  log: LogEntry[];
  ended: boolean;
}

// ----- Report ----------------------------------------------------------------

export interface MissionStats {
  samplesDeposited: number;
  deepDeposited: number;
  scienceRaw: number;
  refills: number;
  o2Dispensed: number;
  o2Shared: number;
  breaches: number;
  downs: number;
  lost: number;
  crew: number;
  classifyCorrect: number;
  classifyWrong: number;
  classifyMissed: number;
  falseAlarms: number;
  distanceWalked: number;
  distanceRun: number;
  secondsOutside: number;
  endedAtS: number;
  allAboard: boolean;
  o2StoreLeft: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface ScoreBreakdown {
  science: number;
  safety: number;
  efficiency: number;
  teamwork: number;
  total: number;
  grade: Grade;
  success: boolean;
}

export interface Insight {
  /** i18n key suffix, e.g. 'small_tanks' -> 'insight.small_tanks'. */
  code: string;
  tone: 'good' | 'bad' | 'neutral';
  params?: Record<string, string | number>;
  /** Optional NASA fact card to show next to it. */
  factId?: string;
}

export interface MissionReport {
  score: ScoreBreakdown;
  stats: MissionStats;
  insights: Insight[];
  design: MissionDesign;
  seed: number;
}

// ----- Room state (low frequency) -------------------------------------------

export interface RoomState {
  code: string;
  phase: Phase;
  seed: number;
  hostId: string;
  /** Increments on every (re)launch. */
  attempt: number;
  players: PlayerInfo[];
  design: MissionDesign;
  check: DesignCheck;
  params: MissionParams | null;
  report: MissionReport | null;
}
