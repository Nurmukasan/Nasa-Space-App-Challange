import { WEATHER } from '../balance';
import type { MissionParams, WeatherState } from '../types';

import { stormActive } from './weather';

/**
 * Current legal speed in px/s. Server (step clamp) and client (local movement)
 * must both use this function so they never disagree.
 */
export function moveSpeed(params: MissionParams, weather: WeatherState, running: boolean): number {
  return (
    (running ? params.runSpeed : params.walkSpeed) * (stormActive(weather) ? WEATHER.stormSpeed : 1)
  );
}
