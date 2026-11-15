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

/** Field specialty of an EVA astronaut: its suit sprite and one small perk (balance.ts CREW). */
export type CrewClassId = 'engineer' | 'scout' | 'geologist' | 'biologist';

export interface PlayerInfo {
  id: string;
  name: string;
  /** Index into PLAYER_COLORS. */
  colorIdx: number;
  role: Role | null;
  /** Chosen in the lobby; used when this player goes outside (roles eva and solo). */
  crewClass: CrewClassId;
  /** True once the player picked a class themselves; crew cannot launch before that. */
  classChosen: boolean;
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
/** Mission scenario (docs/product-logic.md 5.1). 'free' is the classic v1 mission. */
export type ScenarioId = 'training' | 'signal' | 'free';

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

export interface ForecastPoint {
  t: number;
  powerW: number;
  needW: number;
  /** Projected lander O2 store. */
  o2Store: number;
}

/** Design-time projection of the mission over time (docs/product-logic.md 6.10). */
export interface MissionForecast {
  /** About 32 points across the scenario duration. */
  points: ForecastPoint[];
  /** First mission time when available power < need, or null. */
  powerShortAtS: number | null;
  /** Projected time when the O2 store runs out, or null. */
  storeEmptyAtS: number | null;
  /** Farthest deep sample reachable on one tank, metres. */
  deepReachM: number;
  dataReturnPct: number;
}

export interface DesignCheck {
  ok: boolean;
  totals: DesignTotals;
  issues: DesignIssue[];
  prediction: Prediction;
  forecast: MissionForecast;
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
  scenario: ScenarioId;
  /** End of dusk: solar output and light reach their night value. */
  duskEndS: number;
  /** One player in the 'solo' role. */
  solo: boolean;
  /** Crew carries seismometer kits and deploys them; otherwise stations are auto-placed (v1). */
  deployStations: boolean;
  /** Seismometer kits handed to the crew at start. */
  kits: number;
  /** Helmet scanner range in px. */
  scanRange: number;
  /** Raw science that maps to the full Science score in this scenario. */
  scienceFull: number;
  /** Big world content: biome sites, lava tubes, supply caches and the rover (RED SIGNAL). */
  bigWorld: boolean;
}

// ----- EVA (the real-time phase) --------------------------------------------

export type SiteKind = 'delta' | 'crater' | 'basalt' | 'impact' | 'signal';
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
  /** Copied from PlayerInfo at launch: sprite and perk. */
  crewClass: CrewClassId;
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
  /** Seismometer kits carried (deploy with E away from the lander). */
  kits: number;
  /** Id of the fault being repaired at a service port, or null. */
  repairing: string | null;
  /** Helmet scanner reading, or null when nothing is in range. */
  scan: ScanReading | null;
  /** Radiation dose accumulated outside during solar flares (game units). */
  dose: number;
  /** Driving the rover: position follows it, the cabin supplies air. */
  inRover: boolean;
}

/** Distance and direction to the nearest undiscovered site in scanner range. */
export interface ScanReading {
  dist: number;
  /** Radians, 0 = +x. */
  bearing: number;
}

/** Orbital hint about an undiscovered site, shown on the Mission Control map only. */
export interface Anomaly {
  /** Same id as the hidden site. */
  id: string;
  /** Fuzzed centre of the search area, never the exact site. */
  x: number;
  y: number;
  r: number;
  /** Known only with ground-penetrating radar. */
  kind: SiteKind | null;
  richness: 1 | 2 | 3 | null;
}

export type ObjectiveKind =
  | 'deliver'
  | 'deliver_deep'
  | 'deploy_stations'
  | 'locate_signal'
  | 'retrieve_signal'
  | 'discover'
  | 'repair_all'
  | 'all_aboard'
  | 'classify';

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  /** Primary objectives decide mission success; secondary ones add score. */
  primary: boolean;
  target: number;
  progress: number;
  state: 'active' | 'done' | 'failed';
}

export type FaultKind = 'moxie_clog' | 'antenna_drift' | 'battery_fault' | 'panel_dust';
export type ServicePort = 'n' | 'e' | 's' | 'w';

export interface Fault {
  id: string;
  kind: FaultKind;
  /** Exterior hatch where it is repaired with E. */
  port: ServicePort;
  since: number;
  /** 0..1, kept if the repair is interrupted. */
  progress: number;
}

/** Large regions of the big world (docs/product-logic.md 7.1). */
export type BiomeId = 'plains' | 'delta' | 'dunes' | 'ice' | 'lava';

/** Oxygen depot left by an earlier robotic mission: E refills a suit until it runs dry. */
export interface SupplyCache {
  id: string;
  x: number;
  y: number;
  /** O2 units left. */
  o2: number;
}

/** Single-seat pressurized rover (big world only). */
export interface RoverState {
  x: number;
  y: number;
  /** Radians, 0 = +x. */
  facing: number;
  /** Astronaut id at the wheel, or null when parked. */
  driver: string | null;
  /** Battery 0..1; recharges when parked at the lander. */
  charge: number;
  moving: boolean;
}

export interface DustDevil {
  id: string;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  /** Mission time when it dissipates. */
  until: number;
}

/** Solar particle event; public from warnAt. */
export interface FlareState {
  warnAt: number;
  tStart: number;
  tEnd: number;
}

export interface SignalState {
  /** Search zone narrowed by Mission Control picks; null before the first pulse. */
  zone: { x: number; y: number; r: number } | null;
  pulses: number;
  /** Zone small enough: field beacon shown, scanner can detect the source. */
  located: boolean;
  /** Source site discovered by a scanner. */
  found: boolean;
  /** Signal sample delivered to the lander. */
  retrieved: boolean;
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
  faults: Fault[];
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
  /** Distance estimate from the S–P time, px (noisy). 0 until filled by the locate system. */
  distEst: number;
  /** Back-azimuth estimate from P-wave polarization, radians; station 0 only, else null. */
  bearingEst: number | null;
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
  /** RED SIGNAL pulse: locate only, never classified. */
  signal: boolean;
  /** Mission Control's epicentre pick (public), or null. */
  pick: Vec2 | null;
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
  | 'alert'
  | 'discovery'
  | 'deploy'
  | 'repair_done'
  | 'fault'
  | 'devil'
  | 'panel_clean'
  | 'flare_warn'
  | 'flare_start'
  | 'flare_end'
  | 'signal_pulse'
  | 'signal_located'
  | 'signal_found'
  | 'act'
  | 'objective_done'
  | 'window_closing'
  | 'liftoff'
  | 'rover'
  | 'cache'
  | 'biome';

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
  scenario: ScenarioId;
  /** Dramatic act 1..3 (free mission stays 1). */
  act: number;
  objectives: Objective[];
  anomalies: Anomaly[];
  devils: DustDevil[];
  flare: FlareState | null;
  signal: SignalState;
  /** Big world only, otherwise null / empty. */
  rover: RoverState | null;
  caches: SupplyCache[];
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
  discoveries: number;
  stationsDeployed: number;
  repairs: number;
  faultSeconds: number;
  locatePicks: number;
  locateGood: number;
  locateErrorSum: number;
  sandSeconds: number;
  devilSeconds: number;
  doseMax: number;
  signalRetrieved: boolean;
  /** Big world: px driven, suit refills at caches, seconds in lava tubes, biomes reached. */
  roverDistance: number;
  cacheRefills: number;
  caveSeconds: number;
  biomesVisited: BiomeId[];
  crewStats: CrewStats[];
}

/** Per-astronaut numbers for awards. */
export interface CrewStats {
  id: string;
  distance: number;
  /** Raw value of samples delivered. */
  science: number;
  samples: number;
  rescues: number;
  repairs: number;
  discoveries: number;
  o2Used: number;
  secondsOutside: number;
}

export interface TimelineEntry {
  t: number;
  type: FxType;
  playerId?: string;
  n?: number;
  /** Detail of the effect: objective id for objective_done, fault kind for fault/repair_done. */
  s?: string;
}

export interface Award {
  code: string;
  playerId: string;
  n?: number;
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
  /** Suggested design change, highlighted on the design screen after REDESIGN. */
  fix?: { module?: ModuleId; field?: DesignField; value?: string };
}

export interface MissionReport {
  score: ScoreBreakdown;
  stats: MissionStats;
  insights: Insight[];
  design: MissionDesign;
  seed: number;
  scenario: ScenarioId;
  objectives: Objective[];
  timeline: TimelineEntry[];
  awards: Award[];
  /** i18n key of the RED SIGNAL debrief, or null. */
  reveal: string | null;
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
  scenario: ScenarioId;
}
