// =============================================================================
// ALL tunable numbers live here. Game designers edit this file (and catalog.ts)
// only. No magic numbers anywhere else.
// =============================================================================

export const TICK_HZ = 15;
export const TICK_DT = 1 / TICK_HZ;

export const TILE = 16;
/**
 * The world is a square around the lander. v1 was 96 tiles (1536 px); the big world is 352 tiles
 * (5632 px, 13.4x the area). The lander keeps its v1 position, so the world reaches into negative
 * coordinates: every scenario keeps the exact terrain and layout around the landing site.
 */
export const WORLD_TILES = 352;
export const WORLD_PX = TILE * WORLD_TILES; // 5632, the side length
export const VIEW_W = 480;
export const VIEW_H = 270;
export const METERS_PER_PX = 0.25;
export const LANDER_POS = { x: 768, y: 768 };
/** World bounds (inclusive min, exclusive max), centred on the lander. */
export const WORLD_MIN = LANDER_POS.x - WORLD_PX / 2; // -2048
export const WORLD_MAX = WORLD_MIN + WORLD_PX; // 3584

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
/** Airlock: with nothing left in the store, E lets a part-full suit inside (no trap at the door). */
export const AIRLOCK = { emptyStore: 1 };

// ----- owner: A --------------------------------------------------------------
/** Personal assignment budgets; optional and never part of mission scoring. */
export const TASKS = {
  perPlayer: 2,
  rngSalt: 0x7a51,
  attemptSalt: 0x9e3779b9,
  maxRange: 550,
  tankFraction: 0.9,
  travelMargin: 1.15,
  arrivalRadius: 24,
  stationAngles: 24,
  stationRadius: 180,
  disconnectGraceS: 30,
  historyLimit: 4,
  returnReserveS: 15,
};

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
  firstS: 90,
  gapMinS: 55,
  gapMaxS: 75,
  lastS: 600,
  windowMul: 1.5,
  /** Big world: the source lies out in the biomes (RED SIGNAL is the only big-world scenario). */
  sourceMinDist: 1500,
  sourceMaxDist: 2400,
  amp: 0.55,
  signature: { riseS: 0.6, decayS: 6, freqHz: 2.8, noise: 0.06, pressureDip: 0 },
  zoneErrMul: 1.2,
  zoneSlack: 50,
  /** Zone radius from the automatic estimate, by station count (3+ / fewer). */
  autoR3: 170,
  autoR1: 320,
  /** Below autoR3 on purpose: the computer's estimate alone never locates the source. */
  locatedR: 160,
  /** Pulses heard before the source can count as located: keeps the hunt in act II. */
  minPulses: 2,
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
  /** First director event (always the tutorial wind), seconds. */
  firstWindMinS: 45,
  firstWindMaxS: 60,
  /** Third-act crisis start window, seconds. */
  crisisMinS: 510,
  crisisMaxS: 525,
  /** Postpone events while someone is below this O2 fraction or down. */
  tensionO2Frac: 0.25,
  postponeS: 8,
  windowWarnS: 60,
  nearCrewMin: 120,
  nearCrewMax: 260,
  /** Impacts land this far from the lander, away from sample sites (PL 7.17). */
  impactMinDist: 400,
  impactMaxDist: 650,
};

export const SOLO = { classifyMul: 1.5 };

/**
 * One small perk per crew class (types.ts CrewClassId). A value of 1 means no effect.
 * scout walks and runs faster, geologist digs faster, engineer repairs faster,
 * biologist gets more science value from each sample.
 */
export const CREW = {
  speedMul: { engineer: 1, scout: 1.12, geologist: 1, biologist: 1 },
  digMul: { engineer: 1, scout: 1, geologist: 1.3, biologist: 1 },
  repairMul: { engineer: 1.5, scout: 1, geologist: 1, biologist: 1 },
  sampleMul: { engineer: 1, scout: 1, geologist: 1, biologist: 1.2 },
} as const;
export const OBJECTIVE = { secondaryBonus: 20 };
/**
 * Teamwork in training and RED SIGNAL: more ways to earn it than in v1, so each pays less.
 * Bot soak (A12): near-perfect play lands near the 150 cap instead of ~235.
 */
/**
 * Efficiency parts (PL 8.1): each part reaches its cap at half of the budget / time left, the
 * mass and store parts scale linearly. Caps sum to SCORE.efficiencyMax.
 */
export const EFFICIENCY = { budget: 80, mass: 40, store: 40, time: 40, halfMul: 2 };
export const TEAMWORK_V2 = { classifyBonus: 15, goodPickBonus: 12, secondaryBonus: 12 };
export const REPORT = { timelineMax: 80 };
/** v2 causal findings thresholds (docs/product-logic.md 8.2). */
export const REPORT_INSIGHTS = {
  minPicks: 2,
  /** Mean pick error above this, px, is a bad pick record. */
  badPickPx: 160,
  goodPicks: 2,
  faultDowntimeS: 60,
  sandS: 40,
  blindDiscoveries: 2,
  blindAnomalies: 3,
  /** Stations below this make seismo_net the fix for bad picks. */
  netStations: 3,
};
/** Design-time mission forecast (docs/product-logic.md 6.10). */
export const FORECAST = {
  points: 32,
  /** Integration step for the O2 store projection, s. */
  stepS: 1,
  /** Typical crew: two astronauts outside 60% of the time, walking. */
  crew: 2,
  outsideFrac: 0.6,
};
/** Crew awards (docs/product-logic.md 8.4). */
export const AWARDS = {
  order: ['rock_hound', 'explorer', 'lifeguard', 'mechanic', 'pathfinder', 'iron_lungs'] as const,
  ironLungsMinS: 60,
  seismologistPicks: 2,
};

// ----- owner: A · big world (docs/product-logic.md 7.1, 7.24–7.27) -----------------------

/**
 * Training and Free keep the v1 valley (docs/product-logic.md 7.24): 96 tiles (1536 px) square
 * around the same lander position, so their layout and edges are exactly v1.
 */
export const CLASSIC_WORLD_PX = TILE * 96;
/** Nobody walks closer than this to the world edge, px. */
export const WORLD_EDGE = 8;

/** Biome layout and lava tubes. Geography is fixed per landing site (terrain salt). */
export const WORLD = {
  /** Radius of the landing plains around the lander, px (wavy edge). */
  plainsR: 1150,
  /** Outer sectors: delta, dunes, ice, lava; weights = landing-site mix + 1, dunes fixed. */
  duneWeight: 2.5,
  /** Lava tubes in the lava sector. */
  tubeCount: 3,
  tubeMinDist: 1450,
  tubeMaxDist: 2350,
  tubeSegments: 16,
  tubeSegLen: 60,
  tubeTurn: 0.28,
  tubeMinPoints: 7,
  tubeHalfWidthMin: 34,
  tubeHalfWidthMax: 44,
  /** Rock rim (impassable) around the tube floor, px. */
  rimPx: 12,
  /** Skylights: gaps in the rim, radius px. Two per tube. */
  entranceR: 22,
  /** Collision sampling step along a move, px (thinner than the rim). */
  sampleStep: 3,
  tubeAttempts: 40,
  /** Keep this far from the world edge, px. */
  edgeMargin: 160,
};

/** Big-world sample sites beyond the classic three rings. */
export const BIG_SITES = {
  /** Per outer biome. */
  perBiome: 3,
  minDist: 1250,
  maxDist: 2500,
  /** Clearance from tubes and other sites, px. */
  clearance: 90,
  attempts: 30,
};

/** Biome effects on walking (v2 scenarios). Dunes are soft sand everywhere below level 3. */
export const BIOME = {
  dunesHardLevel: 3,
  /** Suit heaters in the ice field. */
  iceO2Mul: 1.15,
  /** Rough basalt in the lava flows. */
  lavaSpeedMul: 0.9,
};

/** Pressurized rover: fast, shielded, a radio relay; one seat. */
export const ROVER = {
  speed: 120,
  /** Speed multiplier on soft sand and in the lava flows. */
  sandMul: 0.8,
  lavaMul: 0.85,
  boardDist: 24,
  exitOffset: 18,
  /** Parked next to the lander at the start. */
  parkOffset: { x: 70, y: 40 },
  /** Px of driving on a full battery. */
  rangePx: 7500,
  /** Seconds from empty to full when parked near the lander. */
  rechargeS: 60,
  dockDist: 110,
  /** Rover antenna: links astronauts near it while it is this many comms ranges from home. */
  antennaMul: 3,
  /** Rovers stay this far outside a tube rim (no skylight fits them; exits land on open ground). */
  tubeClearance: 20,
};

/** Supply caches: oxygen depots of an earlier robotic mission. */
export const CACHES = {
  perBiome: 2,
  minDist: 1050,
  maxDist: 2300,
  o2: 120,
  useDist: 20,
};

// ----- owner: A · digging mini-game (docs/product-logic.md 7.5.1) -----------------------

/** Timing-bar digging in training and RED SIGNAL. Free mission keeps hold-SPACE (v1). */
export const DIG_GAME = {
  /** Seconds for the marker to cross the bar once; it sweeps back and forth. */
  sweepS: 0.9,
  /** Half-widths of the GOOD and PERFECT zones, fractions of the bar. */
  goodHalf: 0.12,
  perfectHalf: 0.05,
  /** Zone centres keep this far from the bar ends. */
  zoneMargin: 0.2,
  /** One stroke digs as deep as this many seconds of v1 continuous digging (x digRate). */
  strokeS: 0.8,
  /** Depth multiplier per grade. */
  mul: { perfect: 1.4, good: 1, miss: 0.1 },
  /** Each good stroke in a row adds this much depth, up to comboMax steps (x1.4). */
  comboStep: 0.1,
  comboMax: 4,
  /** A miss jars the suit: O2 lost, and a longer pause before the next stroke. */
  missO2: 1,
  cooldownS: 0.35,
  missLockS: 0.8,
  /** The session ends after this long without a stroke. */
  idleS: 4,
  /**
   * The client draws the marker about one network trip behind the server. A stroke is judged at
   * the marker position the player saw if the marker was there within this many seconds.
   */
  lagWindowS: 0.4,
  /** Strokes are judged at the last tick, up to one tick before the key press. */
  leadS: 0.07,
  lagStepS: 0.02,
  phaseEps: 0.02,
};
