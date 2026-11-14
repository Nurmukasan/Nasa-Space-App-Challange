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
  forecastWithStationS: 60,
  forecastWithoutS: 15,
};

export const SCORE = {
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
