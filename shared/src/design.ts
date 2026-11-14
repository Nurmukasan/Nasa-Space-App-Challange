// Pure functions: design -> check (totals, issues, prediction) and design -> sim params.
import {
  BAYS_MAX,
  COMMS,
  DATA,
  DIG,
  DISCOVERY,
  LANDER,
  METERS_PER_PX,
  MOVE,
  O2,
  POWER,
  SAMPLE,
  STATIONS,
} from './balance';
import { SCENARIOS } from './scenarios';
import { DIFFICULTIES, MODULES, OBJECTIVES, PRESETS, RELAYS, SITES, VEHICLES } from './catalog';
import type {
  DesignCheck,
  DesignField,
  DesignIssue,
  MissionDesign,
  MissionForecast,
  MissionParams,
  ModuleId,
  ScenarioId,
} from './types';

export function defaultDesign(): MissionDesign {
  return cloneDesign(PRESETS.balanced);
}

export function cloneDesign(d: MissionDesign): MissionDesign {
  return { ...d, modules: [...d.modules] };
}

const FIELD_TABLES: Record<DesignField, Record<string, unknown>> = {
  objective: OBJECTIVES,
  site: SITES,
  vehicle: VEHICLES,
  relay: RELAYS,
  difficulty: DIFFICULTIES,
};

/** Returns a new design, or null if field/value is not valid. */
export function setDesignField(
  d: MissionDesign,
  field: string,
  value: string,
): MissionDesign | null {
  if (!Object.prototype.hasOwnProperty.call(FIELD_TABLES, field)) return null;
  const table = FIELD_TABLES[field as DesignField];
  if (!Object.prototype.hasOwnProperty.call(table, value)) return null;
  return { ...cloneDesign(d), [field]: value } as MissionDesign;
}

/** Returns a new design, or null if the module id is not valid. */
export function toggleModule(d: MissionDesign, id: string, on: boolean): MissionDesign | null {
  if (!Object.prototype.hasOwnProperty.call(MODULES, id)) return null;
  const mid = id as ModuleId;
  const set = new Set(d.modules);
  if (on) set.add(mid);
  else set.delete(mid);
  return { ...d, modules: [...set] };
}

function has(d: MissionDesign, id: ModuleId): boolean {
  return d.modules.includes(id);
}

/** Data produced by the chosen instruments vs. downlink capacity, and the resulting science factor. */
export function dataBudget(d: MissionDesign): { gen: number; cap: number; factor: number } {
  let gen = DATA.baseGen;
  for (const id of d.modules) gen += MODULES[id].dataGen;
  const cap = (has(d, 'antenna_hg') ? DATA.highGainCap : DATA.lowGainCap) + RELAYS[d.relay].dataCap;
  const factor = Math.max(DATA.minFactor, Math.min(1, cap / gen));
  return { gen, cap, factor };
}

export function deriveParams(
  d: MissionDesign,
  seed: number,
  scenario: ScenarioId = 'free',
): MissionParams {
  const sc = SCENARIOS[scenario];
  const obj = OBJECTIVES[d.objective];
  const site = SITES[d.site];
  const diff = DIFFICULTIES[d.difficulty];
  const relay = RELAYS[d.relay];

  const xl = has(d, 'tanks_xl');
  const drill = has(d, 'drill');
  const hg = has(d, 'antenna_hg');
  const net = has(d, 'seismo_net');
  const weather = has(d, 'weather');
  const gpr = has(d, 'gpr');

  const speedMul = (xl ? 0.95 : 1) * (drill ? 0.9 : 1);
  const walkSpeed = MOVE.walk * speedMul;
  const storeInit = LANDER.storeInit + (has(d, 'o2_reserve') ? LANDER.reserveBonus : 0);
  const moxieRate = has(d, 'moxie_l') ? 1.6 : has(d, 'moxie_s') ? 0.8 : 0;
  const moxieNeedW = has(d, 'moxie_l')
    ? -MODULES.moxie_l.powerW
    : has(d, 'moxie_s')
      ? -MODULES.moxie_s.powerW
      : 0;
  const scanNeedW =
    10 +
    (net ? -MODULES.seismo_net.powerW : 0) +
    (weather ? -MODULES.weather.powerW : 0) +
    (gpr ? -MODULES.gpr.powerW : 0);

  return {
    seed,
    objective: d.objective,
    site: d.site,
    difficulty: d.difficulty,
    durationS: sc.durationS,
    quota: obj.quota,
    deepQuota: obj.deepQuota,
    favoredKind: obj.favoredKind,
    tankCapacity: Math.round((xl ? O2.tankXl : O2.tankStd) * diff.o2Mul),
    walkSpeed,
    runSpeed: walkSpeed * (MOVE.run / MOVE.walk),
    digRate: drill ? DIG.drillRate : DIG.shovelRate,
    maxDepth: drill ? DIG.coreDepth : DIG.deepDepth,
    carryCap: SAMPLE.carryCap,
    o2StoreInit: storeInit,
    o2StoreMax: storeInit + LANDER.storeHeadroom,
    moxieRate,
    moxieNeedW,
    commsNeedW: hg ? 10 - MODULES.antenna_hg.powerW : 10,
    scanNeedW,
    baseLoadW: LANDER.baseLoadW,
    solarPeakW: has(d, 'solar') ? MODULES.solar.powerW * site.solarFactor : 0,
    rtgW: has(d, 'rtg') ? MODULES.rtg.powerW : 0,
    hasBattery: has(d, 'battery'),
    commsRange: (hg ? COMMS.highGain : COMMS.lowGain) * relay.rangeMul,
    relay: d.relay,
    relayRangeMul: relay.rangeMul,
    relayPassPeriodS: relay.passPeriodS,
    relayPassWindowS: relay.passWindowS,
    stations: net ? 3 : 1,
    hasWeather: weather,
    hasGpr: gpr,
    dataFactor: dataBudget(d).factor,
    classifyWindowS: diff.classifyWindowS,
    scenario,
    duskEndS: sc.duskEndS,
    solo: false,
    deployStations: sc.deployStations,
    kits: sc.deployStations && net ? STATIONS.kitsWithNet : 0,
    scanRange: DISCOVERY.scanRange * (gpr ? DISCOVERY.gprScanMul : 1),
    scienceFull: sc.scienceFull,
  };
}

/**
 * Design-time projection of power and oxygen over the mission (docs/product-logic.md 6.10).
 * Phase 0 stub: real curves come in task A10.
 */
export function forecastMission(d: MissionDesign, _scenario: ScenarioId = 'free'): MissionForecast {
  return {
    points: [],
    powerShortAtS: null,
    storeEmptyAtS: null,
    deepReachM: 0,
    dataReturnPct: Math.round(dataBudget(d).factor * 100),
  };
}

export function checkDesign(d: MissionDesign, scenario: ScenarioId = 'free'): DesignCheck {
  const diff = DIFFICULTIES[d.difficulty];
  const vehicle = VEHICLES[d.vehicle];
  const relay = RELAYS[d.relay];
  const p = deriveParams(d, 0, scenario);
  const data = dataBudget(d);

  let cost = vehicle.cost + relay.cost;
  let massKg = relay.massKg;
  let baysUsed = 0;
  for (const id of d.modules) {
    const m = MODULES[id];
    cost += m.cost;
    massKg += m.massKg;
    baysUsed += m.bays;
  }
  const powerGenW = p.solarPeakW + p.rtgW;
  const powerUseW =
    p.baseLoadW +
    p.moxieNeedW +
    p.commsNeedW +
    p.scanNeedW +
    (has(d, 'drill') ? -MODULES.drill.powerW : 0);

  const issues: DesignIssue[] = [];
  const err = (code: DesignIssue['code'], params?: DesignIssue['params']) =>
    issues.push({ code, severity: 'error', params });
  const warn = (code: DesignIssue['code'], params?: DesignIssue['params']) =>
    issues.push({ code, severity: 'warning', params });

  if (cost > diff.budget) err('over_budget', { by: cost - diff.budget });
  if (massKg > vehicle.payloadKg) err('over_mass', { by: massKg - vehicle.payloadKg });
  if (baysUsed > BAYS_MAX) err('over_bays', { by: baysUsed - BAYS_MAX });
  if (powerGenW <= 0) err('no_power');
  if (p.moxieRate <= 0) err('no_moxie');
  if (has(d, 'moxie_s') && has(d, 'moxie_l')) err('both_moxie');
  if (powerGenW > 0 && powerUseW > powerGenW)
    warn('power_deficit', { by: Math.round(powerUseW - powerGenW) });
  if (powerGenW > 0 && p.rtgW === 0 && !p.hasBattery) warn('night_power');
  if (!vehicle.relays.includes(d.relay)) err('vehicle_orbit');
  if (data.gen > data.cap) warn('data_bottleneck', { pct: Math.round(data.factor * 100) });
  if (p.deepQuota > 0 && p.maxDepth <= DIG.deepDepth && p.tankCapacity <= O2.tankStd)
    warn('no_deep_tool');
  if (d.objective === 'geophysics' && p.stations < 3) warn('no_seismo_net');

  const nightGen = p.rtgW + (p.hasBattery ? POWER.batteryFloor * p.solarPeakW : 0);
  const prediction = {
    evaSecondsPerTank: Math.round(p.tankCapacity / O2.walk),
    deepDigSeconds: Math.round(DIG.deepDepth / p.digRate),
    refillSeconds: Math.round((p.tankCapacity / O2.refillRate) * 10) / 10,
    quakeIdPct: Math.min(99, (p.stations === 3 ? 85 : 55) + (p.hasWeather ? 10 : 0)),
    commsRangeM: Math.round(p.commsRange * METERS_PER_PX),
    nightPowerPct: powerUseW > 0 ? Math.min(100, Math.round((nightGen / powerUseW) * 100)) : 0,
    walkSpeedPct: Math.round((p.walkSpeed / MOVE.walk) * 100),
  };

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    totals: {
      cost,
      budget: diff.budget,
      massKg,
      massCapKg: vehicle.payloadKg,
      baysUsed,
      baysMax: BAYS_MAX,
      powerGenW: Math.round(powerGenW),
      powerUseW: Math.round(powerUseW),
      dataGen: data.gen,
      dataCap: data.cap,
    },
    issues,
    prediction,
    forecast: forecastMission(d, scenario),
  };
}
