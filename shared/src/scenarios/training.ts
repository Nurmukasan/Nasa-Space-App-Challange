// "Sol 1: First Steps" — 4-minute scripted tutorial and demo (docs/product-logic.md 9.1).
// Beats are filled in task A1.
import type { ScenarioDef } from './types';

export const TRAINING: ScenarioDef = {
  id: 'training',
  durationS: 240,
  duskEndS: 200,
  seed: 2041,
  site: 'jezero',
  deployStations: true,
  knownRings: [1, 2, 3],
  signal: false,
  scienceFull: 120,
  quickPreset: 'balanced',
  beats: [],
  acts: [],
};
