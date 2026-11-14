import { POWER, WEATHER } from '../balance';
import type { System } from './sim';

/** Daylight fades from lightStart to lightEnd over the dusk period. Storms: TODO (start-phase A6). */
export const weatherSystem: System = (sim) => {
  const t = Math.max(0, sim.pub.t);
  const k = Math.min(1, t / POWER.duskEndS);
  const w = sim.pub.weather;
  w.light = WEATHER.lightStart + (WEATHER.lightEnd - WEATHER.lightStart) * k;
  w.solarFactor = 1 - k;
};
