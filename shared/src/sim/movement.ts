import { CREW, LANDER_POS, O2, RETURN, WEATHER } from '../balance';
import { SITES } from '../catalog';
import { terrainMul } from './devils';
import type { CrewClassId, EvaState, MissionParams, WeatherState } from '../types';

import { stormActive } from './weather';
import { inCave } from '../world';

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
  return returnCostFrom(params, weather, distance);
}

/** The same cost for any walking distance, px. */
export function returnCostFrom(
  params: MissionParams,
  weather: WeatherState,
  distance: number,
): number {
  return (distance / moveSpeed(params, weather, false)) * O2.walk * RETURN.margin + RETURN.reserve;
}

/** Identical terrain-aware speed for client prediction and server movement limits. */
export function fieldSpeed(
  params: MissionParams,
  state: EvaState,
  x: number,
  y: number,
  running: boolean,
  crewClass?: CrewClassId,
): number {
  const salt = SITES[params.site].terrainSalt;
  // The storm does not reach into a lava tube.
  const sheltered = params.bigWorld && inCave(x, y, salt);
  return (
    (running ? params.runSpeed : params.walkSpeed) *
    (stormActive(state.weather) && !sheltered ? WEATHER.stormSpeed : 1) *
    terrainMul(state, salt, x, y).speed *
    (crewClass ? CREW.speedMul[crewClass] : 1)
  );
}
