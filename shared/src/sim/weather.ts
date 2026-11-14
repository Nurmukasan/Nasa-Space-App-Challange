import { POWER, WEATHER } from '../balance';
import type { WeatherState } from '../types';
import { pushFx } from './sim';
import type { System } from './sim';

/** Serializable activity flag keeps movement correct during forecasts and after sunset. */
type LiveWeather = WeatherState & { stormActive?: boolean };
export function stormActive(weather: WeatherState): boolean {
  return (weather as LiveWeather).stormActive === true;
}

export const weatherSystem: System = (sim) => {
  const t = Math.max(0, sim.pub.t);
  const k = Math.min(1, t / POWER.duskEndS);
  const w: LiveWeather = sim.pub.weather;
  const storm = sim.hidden.storm;
  const lead = sim.params.hasWeather ? WEATHER.forecastWithStationS : WEATHER.forecastWithoutS;
  w.storm = storm && t >= storm.tStart - lead ? { ...storm } : null;
  w.stormForecastAt = w.storm ? w.storm.tStart - lead : null;
  w.stormActive = storm !== null && t >= storm.tStart && t < storm.tEnd;
  w.light = WEATHER.lightStart + (WEATHER.lightEnd - WEATHER.lightStart) * k;
  w.solarFactor = (1 - k) * (w.stormActive ? WEATHER.stormSolar : 1);
  if (storm && t >= storm.tStart && !sim.hidden.stormStarted) {
    sim.hidden.stormStarted = true;
    pushFx(sim, { type: 'storm_start' });
  }
  if (storm && t >= storm.tEnd && !sim.hidden.stormEnded) {
    sim.hidden.stormEnded = true;
    pushFx(sim, { type: 'storm_end' });
  }
};
