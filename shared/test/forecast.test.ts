// A10: design-time mission forecast (docs/product-logic.md 6.10).
import { expect, it } from 'vitest';
import {
  FORECAST,
  MODULES,
  POWER,
  PRESETS,
  SCENARIOS,
  checkDesign,
  deriveParams,
  forecastMission,
} from '../src';
import type { MissionDesign, ModuleId } from '../src';

const withModules = (modules: ModuleId[]): MissionDesign => ({ ...PRESETS.budget, modules });
const night = (d: MissionDesign, scenario: 'free' | 'signal' | 'training' = 'free') => {
  const f = forecastMission(d, scenario);
  return f.points.filter((pt) => pt.t >= SCENARIOS[scenario].duskEndS);
};

it('gives 32 points over the scenario duration, starting at 0 and ending at the end', () => {
  for (const id of ['free', 'signal', 'training'] as const) {
    const f = forecastMission(PRESETS.balanced, id);
    expect(f.points).toHaveLength(FORECAST.points);
    expect(f.points[0]!.t).toBe(0);
    expect(f.points.at(-1)!.t).toBe(SCENARIOS[id].durationS);
    expect(f.points.every((pt, i) => i === 0 || pt.t > f.points[i - 1]!.t)).toBe(true);
  }
});

it('an RTG gives a flat line at night', () => {
  const pts = night(withModules(['rtg', 'moxie_s']));
  expect(pts.length).toBeGreaterThan(0);
  for (const pt of pts) expect(pt.powerW).toBe(MODULES.rtg.powerW);
});

it('solar arrays without a battery fall to zero by dusk', () => {
  const d = withModules(['solar', 'moxie_s']);
  const f = forecastMission(d);
  expect(f.points[0]!.powerW).toBeGreaterThan(0);
  for (const pt of night(d)) expect(pt.powerW).toBe(0);
  expect(f.powerShortAtS).not.toBeNull();
  expect(f.powerShortAtS!).toBeLessThanOrEqual(SCENARIOS.free.duskEndS);
});

it('a battery keeps solar power at 60% or more', () => {
  const d = withModules(['solar', 'battery', 'moxie_s']);
  const peak = deriveParams(d, 0).solarPeakW;
  for (const pt of forecastMission(d).points)
    expect(pt.powerW).toBeGreaterThanOrEqual(Math.floor(POWER.batteryFloor * peak));
});

it('larger tanks reach deep samples farther; a drill reaches farther than a shovel', () => {
  const base = forecastMission(withModules(['solar', 'moxie_s'])).deepReachM;
  expect(forecastMission(withModules(['solar', 'moxie_s', 'tanks_xl'])).deepReachM).toBeGreaterThan(
    base,
  );
  expect(forecastMission(withModules(['solar', 'moxie_s', 'drill'])).deepReachM).toBeGreaterThan(
    base,
  );
});

it('time follows the scenario: training is shorter and its night starts earlier', () => {
  const d = withModules(['solar', 'moxie_s']);
  const free = forecastMission(d, 'free');
  const training = forecastMission(d, 'training');
  expect(training.points.at(-1)!.t).toBeLessThan(free.points.at(-1)!.t);
  expect(training.powerShortAtS!).toBeLessThan(free.powerShortAtS!);
});

it('projects the O2 store: no MOXIE runs it dry, a reserve lasts longer', () => {
  const none = forecastMission(withModules(['solar']));
  expect(none.storeEmptyAtS).not.toBeNull();
  const reserve = forecastMission(withModules(['solar', 'o2_reserve']));
  expect(reserve.storeEmptyAtS === null || reserve.storeEmptyAtS > none.storeEmptyAtS!).toBe(true);
  expect(none.points.every((pt) => pt.o2Store >= 0)).toBe(true);
});

it('is pure and lands in the design check for the scenario', () => {
  expect(forecastMission(PRESETS.science, 'signal')).toEqual(
    forecastMission(PRESETS.science, 'signal'),
  );
  expect(checkDesign(PRESETS.science, 'signal').forecast).toEqual(
    forecastMission(PRESETS.science, 'signal'),
  );
  expect(checkDesign(PRESETS.balanced).forecast.dataReturnPct).toBeGreaterThan(0);
});
