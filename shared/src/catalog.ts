// =============================================================================
// Mission design catalog: everything the player can choose. Pure data.
// Display names and descriptions live in client i18n under the same ids.
// Numbers are game units, simplified from real missions (see docs/product-logic.md).
// =============================================================================
import type {
  DifficultyId,
  MissionDesign,
  ModuleGroup,
  ModuleId,
  ObjectiveId,
  PresetId,
  RelayId,
  SiteId,
  SiteKind,
  VehicleId,
} from './types';

export interface ObjectiveDef {
  id: ObjectiveId;
  favoredKind: SiteKind;
  quota: number;
  deepQuota: number;
}

export interface SiteDef {
  id: SiteId;
  solarFactor: number;
  /** 0..1, how much of the terrain has ledges (rockfall risk). */
  ledgeScale: number;
  quakes: number;
  impacts: number;
  winds: number;
  stormChance: number;
  /** Relative weights of sample site kinds. */
  mix: { delta: number; crater: number; basalt: number };
  terrainSalt: number;
}

export interface VehicleDef {
  id: VehicleId;
  cost: number;
  payloadKg: number;
  /** Relay orbits this vehicle can deliver. */
  relays: RelayId[];
}

export interface RelayDef {
  id: RelayId;
  cost: number;
  massKg: number;
  rangeMul: number;
  /** Extra downlink capacity, Mb per sol. */
  dataCap: number;
  passPeriodS: number;
  passWindowS: number;
}

export interface ModuleDef {
  id: ModuleId;
  group: ModuleGroup;
  cost: number;
  massKg: number;
  /** Positive = generates, negative = consumes. */
  powerW: number;
  bays: number;
  /** Science data this module produces, Mb per sol. */
  dataGen: number;
}

export interface DifficultyDef {
  id: DifficultyId;
  budget: number;
  o2Mul: number;
  classifyWindowS: number;
}

export const OBJECTIVES: Record<ObjectiveId, ObjectiveDef> = {
  astrobiology: { id: 'astrobiology', favoredKind: 'delta', quota: 5, deepQuota: 2 },
  ice: { id: 'ice', favoredKind: 'crater', quota: 5, deepQuota: 1 },
  geophysics: { id: 'geophysics', favoredKind: 'basalt', quota: 4, deepQuota: 1 },
};

export const SITES: Record<SiteId, SiteDef> = {
  jezero: {
    id: 'jezero',
    solarFactor: 1.0,
    ledgeScale: 1.0,
    quakes: 2,
    impacts: 1,
    winds: 3,
    stormChance: 0.5,
    mix: { delta: 5, crater: 1, basalt: 2 },
    terrainSalt: 11,
  },
  elysium: {
    id: 'elysium',
    solarFactor: 1.0,
    ledgeScale: 0.5,
    quakes: 4,
    impacts: 1,
    winds: 2,
    stormChance: 0.3,
    mix: { delta: 1, crater: 2, basalt: 5 },
    terrainSalt: 23,
  },
  arcadia: {
    id: 'arcadia',
    solarFactor: 0.7,
    ledgeScale: 0.7,
    quakes: 1,
    impacts: 2,
    winds: 3,
    stormChance: 0.4,
    mix: { delta: 1, crater: 5, basalt: 2 },
    terrainSalt: 37,
  },
};

export const VEHICLES: Record<VehicleId, VehicleDef> = {
  medium: { id: 'medium', cost: 50, payloadKg: 600, relays: ['none', 'low_orbit'] },
  heavy: { id: 'heavy', cost: 85, payloadKg: 900, relays: ['none', 'low_orbit', 'areostationary'] },
  superheavy: {
    id: 'superheavy',
    cost: 140,
    payloadKg: 1300,
    relays: ['none', 'low_orbit', 'areostationary'],
  },
};

export const RELAYS: Record<RelayId, RelayDef> = {
  none: {
    id: 'none',
    cost: 0,
    massKg: 0,
    rangeMul: 1,
    dataCap: 0,
    passPeriodS: 0,
    passWindowS: 0,
  },
  low_orbit: {
    id: 'low_orbit',
    cost: 25,
    massKg: 80,
    rangeMul: 1,
    dataCap: 80,
    passPeriodS: 120,
    passWindowS: 35,
  },
  areostationary: {
    id: 'areostationary',
    cost: 45,
    massKg: 150,
    rangeMul: 1.6,
    dataCap: 60,
    passPeriodS: 0,
    passWindowS: 0,
  },
};

export const MODULES: Record<ModuleId, ModuleDef> = {
  solar: { id: 'solar', group: 'power', cost: 14, massKg: 60, powerW: 240, bays: 1, dataGen: 0 },
  rtg: { id: 'rtg', group: 'power', cost: 48, massKg: 210, powerW: 300, bays: 1, dataGen: 0 },
  battery: { id: 'battery', group: 'power', cost: 12, massKg: 90, powerW: 0, bays: 1, dataGen: 0 },
  moxie_s: {
    id: 'moxie_s',
    group: 'life',
    cost: 18,
    massKg: 70,
    powerW: -140,
    bays: 1,
    dataGen: 0,
  },
  moxie_l: {
    id: 'moxie_l',
    group: 'life',
    cost: 30,
    massKg: 120,
    powerW: -280,
    bays: 1,
    dataGen: 0,
  },
  o2_reserve: {
    id: 'o2_reserve',
    group: 'life',
    cost: 10,
    massKg: 80,
    powerW: 0,
    bays: 1,
    dataGen: 0,
  },
  tanks_xl: { id: 'tanks_xl', group: 'life', cost: 16, massKg: 96, powerW: 0, bays: 0, dataGen: 0 },
  drill: { id: 'drill', group: 'tools', cost: 36, massKg: 240, powerW: -90, bays: 1, dataGen: 20 },
  seismo_net: {
    id: 'seismo_net',
    group: 'science',
    cost: 20,
    massKg: 45,
    powerW: -20,
    bays: 1,
    dataGen: 40,
  },
  weather: {
    id: 'weather',
    group: 'science',
    cost: 8,
    massKg: 12,
    powerW: -8,
    bays: 1,
    dataGen: 10,
  },
  gpr: { id: 'gpr', group: 'science', cost: 12, massKg: 25, powerW: -15, bays: 1, dataGen: 30 },
  antenna_hg: {
    id: 'antenna_hg',
    group: 'comms',
    cost: 14,
    massKg: 45,
    powerW: -20,
    bays: 1,
    dataGen: 0,
  },
};

export const MODULE_ORDER: ModuleId[] = [
  'solar',
  'rtg',
  'battery',
  'moxie_s',
  'moxie_l',
  'o2_reserve',
  'tanks_xl',
  'drill',
  'seismo_net',
  'weather',
  'gpr',
  'antenna_hg',
];

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  cadet: { id: 'cadet', budget: 280, o2Mul: 1.2, classifyWindowS: 12 },
  flight: { id: 'flight', budget: 250, o2Mul: 1.0, classifyWindowS: 8 },
  commander: { id: 'commander', budget: 220, o2Mul: 0.9, classifyWindowS: 6 },
};

export const PRESETS: Record<PresetId, MissionDesign> = {
  balanced: {
    objective: 'astrobiology',
    site: 'jezero',
    vehicle: 'heavy',
    relay: 'none',
    difficulty: 'flight',
    modules: ['solar', 'battery', 'moxie_s', 'tanks_xl', 'seismo_net', 'antenna_hg'],
  },
  budget: {
    objective: 'astrobiology',
    site: 'jezero',
    vehicle: 'medium',
    relay: 'none',
    difficulty: 'flight',
    modules: ['solar', 'moxie_s', 'o2_reserve'],
  },
  science: {
    objective: 'astrobiology',
    site: 'jezero',
    vehicle: 'heavy',
    relay: 'low_orbit',
    difficulty: 'flight',
    modules: ['rtg', 'moxie_s', 'drill', 'seismo_net'],
  },
};
