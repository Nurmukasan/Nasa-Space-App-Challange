import { LANDER_POS, O2, RETURN, WEATHER } from '../balance';
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

/** Oxygen needed to reach the airlock at walking speed, including a safety reserve. */
export function returnCost(
  params: MissionParams,
  weather: WeatherState,
  x: number,
  y: number,
): number {
  const distance = Math.max(0, Math.hypot(x - LANDER_POS.x, y - LANDER_POS.y) - O2.airlockRadius);
  return (distance / moveSpeed(params, weather, false)) * O2.walk * RETURN.margin + RETURN.reserve;
}
