import type { ScenarioId } from '../types';
import { FREE } from './free';
import { SIGNAL_MISSION } from './signal';
import { TRAINING } from './training';
import type { ScenarioDef } from './types';

export type { ActDef, Beat, BeatAction, DirectorEvent, ScenarioDef } from './types';

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  training: TRAINING,
  signal: SIGNAL_MISSION,
  free: FREE,
};

export const SCENARIO_ORDER: ScenarioId[] = ['training', 'signal', 'free'];

/** Validates an id from the network (guards against '__proto__' and friends). */
export function isScenarioId(v: unknown): v is ScenarioId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SCENARIOS, v);
}
