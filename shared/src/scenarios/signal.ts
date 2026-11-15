// "Sol 47: Red Signal" — the main 8-minute mission (docs/product-logic.md 5.3, 7.17).
// Story beats and director acts (pool weight = max events of that kind in the act).
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
  // Bot soak (A12): near-perfect bots average ~690 raw science; full marks at ~80% of that.
  scienceFull: 560,
  // Science (RTG, drill, seismometer net) succeeds 8/10 vs 4/10 for Balanced in the soak.
  quickPreset: 'science',
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
  acts: [
    { from: 0, gapS: [40, 60], pool: { devil: 1 } },
    { from: 150, gapS: [30, 45], pool: { quake: 2, impact: 1, devil: 2, wind: 1, fault: 1 } },
    { from: 330, gapS: [25, 40], pool: { quake: 1, devil: 1, fault: 1 } },
  ],
  objectives: [
    { kind: 'deliver', primary: true, target: 'quota', minus: -1, min: 3 },
    { kind: 'retrieve_signal', primary: true, target: 1 },
    // Mission Control's part of the hunt (docs/product-logic.md 7.12, 7.18).
    { kind: 'locate_signal', primary: false, target: 1 },
    { kind: 'deliver_deep', primary: false, target: 'deep' },
    { kind: 'deploy_stations', primary: false, target: 'kits' },
    { kind: 'repair_all', primary: false, target: 1 },
    { kind: 'all_aboard', primary: false, target: 1 },
  ],
};
