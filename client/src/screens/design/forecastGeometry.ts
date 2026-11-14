import type { ForecastPoint } from '@rs/shared';
export const CHART = { width: 480, height: 220, left: 40, right: 440, top: 24, bottom: 180 };
export function forecastGeometry(points: ForecastPoint[], duration: number) {
  const maxPower = Math.max(1, ...points.map((p) => Math.max(p.powerW, p.needW)));
  const maxOxygen = Math.max(1, ...points.map((p) => p.o2Store));
  const x = (time: number) =>
    CHART.left +
    Math.max(0, Math.min(1, time / Math.max(1, duration))) * (CHART.right - CHART.left);
  const y = (value: number, max: number) =>
    CHART.bottom - Math.max(0, Math.min(1, value / max)) * (CHART.bottom - CHART.top);
  const line = (key: 'powerW' | 'needW' | 'o2Store', max: number) =>
    points
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(2)},${y(p[key], max).toFixed(2)}`)
      .join(' ');
  return {
    x,
    y,
    maxPower,
    maxOxygen,
    power: line('powerW', maxPower),
    need: line('needW', maxPower),
    oxygen: line('o2Store', maxOxygen),
  };
}
