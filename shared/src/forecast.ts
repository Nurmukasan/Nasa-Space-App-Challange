// Design-time projection of power and oxygen over the mission (docs/product-logic.md 6.10).
// Pure: the same design and scenario always give the same forecast.
import { DIG, FORECAST, METERS_PER_PX, O2, POWER } from './balance';
import { MODULES } from './catalog';
import { dataBudget, deriveParams } from './design';
import type { ForecastPoint, MissionDesign, MissionForecast, MissionParams } from './types';

/** Power available at mission time `t`: RTG plus arrays fading to dusk, battery holds a floor. */
function powerAt(p: MissionParams, t: number): number {
  let sun = 1 - Math.min(1, Math.max(0, t) / p.duskEndS);
  if (p.hasBattery) sun = Math.max(sun, POWER.batteryFloor);
  return p.rtgW + p.solarPeakW * sun;
}

/** Same load as the design check: base, MOXIE, comms, instruments and the drill. */
function needOf(p: MissionParams, d: MissionDesign): number {
  return (
    p.baseLoadW +
    p.moxieNeedW +
    p.commsNeedW +
    p.scanNeedW +
    (d.modules.includes('drill') ? -MODULES.drill.powerW : 0)
  );
}

/** Farthest deep sample on one tank: walk there and back plus dig 1 m, in metres. */
function deepReach(p: MissionParams): number {
  const digO2 = (DIG.deepDepth / p.digRate) * O2.dig;
  const walkO2 = p.tankCapacity - digO2;
  if (walkO2 <= 0) return 0;
  const oneWayPx = ((walkO2 / O2.walk) * p.walkSpeed) / 2;
  return Math.round(oneWayPx * METERS_PER_PX);
}

export function forecastMission(
  d: MissionDesign,
  scenario: MissionParams['scenario'] = 'free',
): MissionForecast {
  const p = deriveParams(d, 0, scenario);
  const needW = needOf(p, d);
  const crewUse = FORECAST.crew * FORECAST.outsideFrac * O2.walk;
  const every = p.durationS / (FORECAST.points - 1);

  const points: ForecastPoint[] = [];
  let store = p.o2StoreInit;
  let storeEmptyAtS: number | null = null;
  let nextPoint = 0;
  for (let t = 0; points.length < FORECAST.points; t += FORECAST.stepS) {
    if (t >= nextPoint - 1e-6 || t >= p.durationS) {
      const at = Math.min(p.durationS, nextPoint);
      points.push({
        t: Math.round(at),
        powerW: Math.round(powerAt(p, at)),
        needW: Math.round(needW),
        o2Store: Math.round(store),
      });
      nextPoint = points.length * every;
    }
    const supply = needW > 0 ? Math.min(1, powerAt(p, t) / needW) : 1;
    store = Math.min(p.o2StoreMax, store + (p.moxieRate * supply - crewUse) * FORECAST.stepS);
    if (store <= 0) {
      store = 0;
      if (storeEmptyAtS === null && t + FORECAST.stepS <= p.durationS)
        storeEmptyAtS = t + FORECAST.stepS;
    }
  }
  const short = points.find((pt) => pt.powerW < pt.needW);
  return {
    points,
    powerShortAtS: short ? short.t : null,
    storeEmptyAtS,
    deepReachM: deepReach(p),
    dataReturnPct: Math.round(dataBudget(d).factor * 100),
  };
}
