import type { MissionParams, WeatherState } from '../types';

/**
 * Current legal speed in px/s. Server (step clamp) and client (local movement)
 * must both use this function so they never disagree.
 * TODO (start-phase A4): multiply by WEATHER.stormSpeed while a storm is active.
 */
export function moveSpeed(params: MissionParams, _weather: WeatherState, running: boolean): number {
  return running ? params.runSpeed : params.walkSpeed;
}
