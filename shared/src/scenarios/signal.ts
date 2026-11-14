// "Sol 47: Red Signal" — the main 8-minute mission (docs/product-logic.md 5.3, 7.17).
// Story beats are filled in task A1, director acts in task A5.
import type { ScenarioDef } from './types';

export const SIGNAL_MISSION: ScenarioDef = {
  id: 'signal',
  durationS: 480,
  duskEndS: 360,
  seed: null,
  site: null,
  deployStations: true,
  knownRings: [1],
  signal: true,
  scienceFull: 200,
  quickPreset: 'balanced',
  beats: [],
  acts: [],
};
