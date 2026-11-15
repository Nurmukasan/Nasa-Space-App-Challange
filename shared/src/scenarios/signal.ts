// "Sol 47: Red Signal" — the main 12-minute big-world mission (docs/product-logic.md 5.3, 7.17).
// Story beats and director acts (pool weight = max events of that kind in the act).
import type { ScenarioDef } from './types';

export const SIGNAL_MISSION: ScenarioDef = {
  id: 'signal',
  // Big world (v2.1): 12 minutes to cross biomes, search lava tubes and run the signal down.
  durationS: 720,
  duskEndS: 540,
  seed: null,
  site: null,
  deployStations: true,
  knownRings: [1],
  signal: true,
  bigWorld: true,
  // Big-world soak: two near-perfect bots average ~990 raw science; full marks at ~80% of that.
  scienceFull: 800,
  // Science (RTG, drill, seismometer net) succeeds 8/10 vs 4/10 for Balanced in the soak.
  quickPreset: 'science',
  beats: [
    { at: 0, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.touchdown' } },
    { at: 3, action: { kind: 'radio', from: 'earth', key: 'story.signal.brief' } },
    { at: 30, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.seismo' } },
    { at: 45, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.rover' } },
    { at: 240, action: { kind: 'act', act: 2 } },
    { at: 242, action: { kind: 'radio', from: 'earth', key: 'story.signal.act2' } },
    { at: 510, action: { kind: 'act', act: 3 } },
    { at: 512, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.act3' } },
    { at: 660, action: { kind: 'radio', from: 'tulpar', key: 'story.signal.window' } },
    { at: 660, action: { kind: 'window' } },
  ],
  acts: [
    { from: 0, gapS: [45, 65], pool: { devil: 2 } },
    { from: 240, gapS: [35, 50], pool: { quake: 3, impact: 1, devil: 3, wind: 1, fault: 2 } },
    { from: 510, gapS: [30, 45], pool: { quake: 1, devil: 1, fault: 1 } },
  ],
  objectives: [
    { kind: 'deliver', primary: true, target: 'quota', minus: -1, min: 3 },
    { kind: 'retrieve_signal', primary: true, target: 1 },
    // Mission Control's part of the hunt (docs/product-logic.md 7.12, 7.18).
    { kind: 'locate_signal', primary: false, target: 1 },
    // Big world: go and look (anomalies in every biome, lava tubes).
    { kind: 'discover', primary: false, target: 3 },
    { kind: 'deliver_deep', primary: false, target: 'deep' },
    { kind: 'deploy_stations', primary: false, target: 'kits' },
    { kind: 'repair_all', primary: false, target: 1 },
    { kind: 'all_aboard', primary: false, target: 1 },
  ],
};
