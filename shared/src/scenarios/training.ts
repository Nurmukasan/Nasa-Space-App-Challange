// "Sol 1: First Steps" — 4-minute scripted tutorial and demo (docs/product-logic.md 9.1).
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
  // Sorted by time. Radio keys live in client/src/i18n/en/story.ts.
  beats: [
    { at: 0, action: { kind: 'radio', from: 'tulpar', key: 'story.training.touchdown' } },
    { at: 3, action: { kind: 'radio', from: 'earth', key: 'story.training.brief' } },
    { at: 40, action: { kind: 'radio', from: 'tulpar', key: 'story.training.seismo' } },
    { at: 55, action: { kind: 'event', event: 'wind', near: 'station' } },
    { at: 95, action: { kind: 'event', event: 'quake', near: 'crew' } },
    { at: 148, action: { kind: 'event', event: 'impact', near: 'lander', dist: 450 } },
    { at: 185, action: { kind: 'radio', from: 'earth', key: 'story.training.flare' } },
    { at: 185, action: { kind: 'flare', leadS: 30, durS: 25 } },
    { at: 210, action: { kind: 'radio', from: 'tulpar', key: 'story.training.window' } },
    { at: 210, action: { kind: 'window' } },
  ],
  acts: [],
};
