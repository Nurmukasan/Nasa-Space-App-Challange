import { expect, it } from 'vitest';
import { CHART, forecastGeometry } from './forecastGeometry';
it('uses a common watt scale and a separate oxygen scale over the scenario duration', () => {
  const g = forecastGeometry(
    [
      { t: 0, powerW: 100, needW: 50, o2Store: 200 },
      { t: 240, powerW: 0, needW: 50, o2Store: 0 },
    ],
    240,
  );
  expect(g.maxPower).toBe(100);
  expect(g.maxOxygen).toBe(200);
  expect(g.x(0)).toBe(CHART.left);
  expect(g.x(240)).toBe(CHART.right);
  expect(g.y(0, g.maxPower)).toBe(CHART.bottom);
  expect(g.y(100, g.maxPower)).toBe(CHART.top);
  expect(g.power).toContain(`L${CHART.right.toFixed(2)},${CHART.bottom.toFixed(2)}`);
  expect(g.oxygen).toBe(g.power);
});
it('does not fabricate a forecast for empty engine data', () => {
  const g = forecastGeometry([], 0);
  expect(g.power).toBe('');
  expect(g.need).toBe('');
  expect(g.oxygen).toBe('');
  expect(Number.isFinite(g.x(0))).toBe(true);
});
