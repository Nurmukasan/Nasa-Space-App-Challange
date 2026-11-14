// "Sol 47: Red Signal" — the main 8-minute mission (docs/product-logic.md 5.3, 7.17).
// Story beats below; director acts with event pools arrive in task A5.
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
  beats: [
    { at: 0, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.touchdown' } },
    { at: 3, action: { kind: 'radio', from: 'earth', key: 'story.signal.brief' } },
    { at: 30, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.seismo' } },
    { at: 150, action: { kind: 'act', act: 2 } },
    { at: 152, action: { kind: 'radio', from: 'earth', key: 'story.signal.act2' } },
    { at: 330, action: { kind: 'act', act: 3 } },
    { at: 332, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.act3' } },
    { at: 420, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.window' } },
    { at: 420, action: { kind: 'window' } },
  ],
  acts: [],
  objectives: [
    { kind: 'deliver', primary: true, target: 'quota', minus: 1, min: 3 },
    { kind: 'retrieve_signal', primary: true, target: 1 },
    { kind: 'deliver_deep', primary: false, target: 'deep' },
    { kind: 'deploy_stations', primary: false, target: 'kits' },
    { kind: 'repair_all', primary: false, target: 1 },
    { kind: 'all_aboard', primary: false, target: 1 },
  ],
};
