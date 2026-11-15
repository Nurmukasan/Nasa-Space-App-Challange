// Classic v1 mission. Must keep v1 behaviour: the foundation tests run on it.
import { MISSION_DURATION_S, POWER, SCORE } from '../balance';
import type { ScenarioDef } from './types';

export const FREE: ScenarioDef = {
  id: 'free',
  durationS: MISSION_DURATION_S,
  duskEndS: POWER.duskEndS,
  seed: null,
  site: null,
  deployStations: false,
  knownRings: [1, 2, 3],
  signal: false,
  bigWorld: false,
  scienceFull: SCORE.scienceFull,
  quickPreset: 'balanced',
  beats: [],
  acts: [],
  // v1 success rule: quota and deep quota; all aboard is scored separately.
  objectives: [
    { kind: 'deliver', primary: true, target: 'quota' },
    { kind: 'deliver_deep', primary: true, target: 'deep' },
    { kind: 'all_aboard', primary: false, target: 1 },
  ],
};
