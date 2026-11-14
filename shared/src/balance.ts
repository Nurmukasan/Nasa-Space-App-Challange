// =============================================================================
// ALL tunable numbers live here. Game designers edit this file (and catalog.ts)
// only. No magic numbers anywhere else.
// =============================================================================

export const TICK_HZ = 15;
export const TICK_DT = 1 / TICK_HZ;

export const TILE = 16;
export const WORLD_TILES = 96;
export const WORLD_PX = TILE * WORLD_TILES; // 1536
export const VIEW_W = 480;
export const VIEW_H = 270;
export const METERS_PER_PX = 0.25;
export const LANDER_POS = { x: WORLD_PX / 2, y: WORLD_PX / 2 };

export const MAX_PLAYERS = 4;
export const MAX_EVA = 3;
export const PLAYER_COLORS = [0x50e6f0, 0xff7828, 0x78dc5a, 0xf05ac8];

export const LAUNCH_COUNTDOWN_S = 5;
export const MISSION_DURATION_S = 600;
export const BAYS_MAX = 6;

export const MOVE = {
  walk: 44, // px per second
  run: 80,
  radius: 5,
  /** Server accepts a client step up to this factor above the legal distance. */
  slack: 1.6,
};

export const O2 = {
  tankStd: 60,
  tankXl: 90,
  // consumption, units per second
  idle: 0.5,
  walk: 1.0,
  run: 2.4,
  dig: 1.6,
  leakExtra: 1.5,
  breachLoss: 15,
  lowFrac: 0.25,
  downSeconds: 20,
  shareAmount: 15,
  shareReserve: 5,
  shareRange: 20,
  /** Units per second while refilling at the airlock. */
  refillRate: 30,
  airlockRadius: 28,
};

export const DIG = {
  shovelRate: 0.05, // 1 m in 20 s
  drillRate: 1 / 6, // 1 m in 6 s
  surfaceDepth: 0.2,
  deepDepth: 1.0,
  coreDepth: 2.0,
  reach: 14,
  thresholdEpsilon: 0.001,
};

export const SAMPLE = {
  /** Base value by richness 1..3 (index 0 unused). */
  base: [0, 10, 16, 24],
  tierMul: { surface: 1, deep: 2, core: 3 },
  favoredMul: 1.5,
  impactMul: 3,
  carryCap: 2,
  iceLifetimeS: 150,
};

export const LANDER = {
  storeInit: 250,
  storeHeadroom: 150,
  reserveBonus: 200,
  baseLoadW: 40,
};

export const POWER = {
  /** Solar output goes from 1 to 0 linearly over this many seconds (sunset). */
  duskEndS: 420,
  batteryFloor: 0.6,
  defaultAlloc: { moxie: 0.5, comms: 0.25, scan: 0.25 },
};

/** Data is a resource: every instrument produces it, antenna and relay carry it home. */
export const DATA = {
  baseGen: 30, // cameras and the built-in seismometer
  lowGainCap: 60,
  highGainCap: 140,
  /** Science multiplier never drops below this, however bad the bottleneck. */
  minFactor: 0.5,
};

export const COMMS = {
  relayFirstOpenS: 60,
  lowGain: 300,
  highGain: 520,
  /** Range multiplier at 0% comms efficiency. */
  minEffMul: 0.5,
};

export const SEISMIC = {
  waveSpeed: 300, // px per second
  rockfallDelayS: 9,
  rockfallRadius: 150,
  ledgeHitDist: 28,
  stationDist: 260,
  dangerShowS: 8,
  uncertainty1: 320,
  uncertainty3: 40,
  firstEventMinS: 75,
  firstEventMaxS: 95,
  secondEventMinS: 150,
  secondEventMaxS: 190,
  maxGapS: 85,
  quakeMinDist: 250,
  quakeMaxDist: 600,
  impactMinDist: 450,
  impactMaxDist: 700,
  impactSiteClearance: 120,
  epicentreAttempts: 20,
  epicentreLedgeDist: 40,
  ampFalloff: 1400,
  minAmp: 0.25,
  noisePenalty: 2,
  fireballLeadS: 2,
  debugDelayS: 1,
  resolvedKeep: 3,
  hazardKeepS: 2,
  warningTailS: 1,
  minGapS: 55,
  lastEventS: 540,
};

export const WEATHER = {
  lightStart: 1.0,
  lightEnd: 0.12,
  stormSolar: 0.3,
  stormComms: 0.7,
  stormSpeed: 0.85,
  stormDurS: 90,
  stormEarliestS: 330,
  stormLatestS: 420,
  debugDelayS: 5,
  forecastWithStationS: 60,
  forecastWithoutS: 15,
};

export const SCORE = {
  geoClassifyScience: 12,
  scienceMax: 400,
  /** Raw science that maps to scienceMax. */
  scienceFull: 220,
  safetyMax: 250,
  breachPenalty: 25,
  downPenalty: 10,
  efficiencyMax: 200,
  teamworkMax: 150,
  classifyBonus: 30,
  falseAlarmPenalty: 20,
  shareBonus: 15,
  allAboardBonus: 30,
  grades: { S: 850, A: 700, B: 550, C: 400 },
};

/** Stylized station signatures, never included as event labels before resolution. */
export const SIGNALS = {
  quake: { riseS: 3.5, decayS: 14, freqHz: 1.2, noise: 0.08, pressureDip: 0 },
  impact: { riseS: 0.25, decayS: 2.5, freqHz: 4, noise: 0.08, pressureDip: 0 },
  wind: { riseS: 1.5, decayS: 4, freqHz: 2.2, noise: 0.35, pressureDip: 0.8 },
};

/** Thresholds for causal report findings. */
export const INSIGHTS = {
  maxCausal: 5,
  frequentRefills: 3,
  fewRefills: 2,
  lowStoreFrac: 0.2,
  runFrac: 0.35,
  dataFrac: 0.8,
  netCorrect: 2,
  leanBudgetFrac: 0.25,
};

// =============================================================================
// v2 numbers (docs/phases.md, phase 0). Edit only the blocks of your owner tag.
// =============================================================================

// ----- owner: B --------------------------------------------------------------

export const DISCOVERY = {
  /** Helmet scanner range, px. */
  scanRange: 110,
  gprScanMul: 1.6,
  /** Closer than this, a hidden site is discovered. */
  revealDist: 22,
  anomalyR: 70,
  /** Max offset of an anomaly centre from the real site. */
  anomalyFuzz: 40,
  /** Raw science per discovery. */
  science: 6,
};

export const STATIONS = {
  /** Kits with seismo_net; with the lander-mounted station that makes three. */
  kitsWithNet: 2,
  landerOffset: { x: 0, y: 26 },
  minFromLander: 110,
  minBetween: 120,
};

export const SAND = { threshold: 0.35, speedMul: 0.6, o2Mul: 1.3, waveX: 73, waveY: 91 };

export const DEVIL = {
  rMin: 18,
  rMax: 28,
  speedMin: 14,
  speedMax: 22,
  lifeMin: 35,
  lifeMax: 55,
  /** Spawn distance from the targeted astronaut, px. */
  spawnMin: 120,
  spawnMax: 250,
  speedMul: 0.7,
  o2Extra: 0.8,
  /** A devil this close to the lander clears panel dust. */
  cleanDist: 40,
  minLight: 0.4,
  turnRate: 0.6,
};

/** Cosmetic field dressing; no collision or simulation effects. */
export const PROPS = {
  rockMin: 40,
  rockMax: 60,
  boulderMin: 4,
  boulderMax: 6,
  clearance: 24,
  attempts: 200,
  debrisMinRadius: 65,
  debrisMaxRadius: 100,
};
/** Point of no return: walk cost home × margin + reserve. */
export const RETURN = { margin: 1.15, reserve: 5, warningUnits: 10 };

// ----- owner: A --------------------------------------------------------------

export const LOCATE = {
  /** Relative error of the S–P distance at full instrument power. */
  distErr: 0.12,
  /** Single-station back-azimuth error, radians. */
  bearingErr: 0.5,
  /** Warning zone radius around the pick or estimate, px. */
  warnRadius: 170,
  goodPx: 80,
  goodBonus: 20,
};

export const SIGNAL = {
  firstS: 95,
  gapMinS: 50,
  gapMaxS: 70,
  lastS: 360,
  windowMul: 1.5,
  sourceMinDist: 500,
  sourceMaxDist: 680,
  amp: 0.55,
  signature: { riseS: 0.6, decayS: 6, freqHz: 2.8, noise: 0.06, pressureDip: 0 },
  zoneErrMul: 1.2,
  zoneSlack: 50,
  /** Zone radius from the automatic estimate, by station count (3+ / fewer). */
  autoR3: 170,
  autoR1: 320,
  locatedR: 140,
  /** Value of the deep signal sample; core is worth tierMul.core / tierMul.deep more. */
  sampleValue: 60,
  feelNear: 200,
  feelFar: 450,
};

export const FAULTS = {
  repairS: 6,
  /** Service port distance from the lander centre, px. */
  portDist: 30,
  portRadius: 14,
  maxActive: 2,
  antennaMul: 0.6,
  panelMul: 0.5,
  repairBonus: 10,
  ports: { moxie_clog: 'e', antenna_drift: 'n', panel_dust: 's', battery_fault: 'w' } as const,
};

export const FLARE = { leadS: 40, durS: 40, doseRate: 2, doseLimit: 50, penaltyPer10: 10 };

export const DIRECTOR = {
  /** Postpone events while someone is below this O2 fraction or down. */
  tensionO2Frac: 0.25,
  postponeS: 8,
  windowWarnS: 60,
  nearCrewMin: 120,
  nearCrewMax: 260,
};

export const SOLO = { classifyMul: 1.5 };
export const OBJECTIVE = { secondaryBonus: 20 };
export const REPORT = { timelineMax: 80 };
