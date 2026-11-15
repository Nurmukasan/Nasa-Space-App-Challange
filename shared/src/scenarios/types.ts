// Shapes of scenario data. A scenario is data, not code (docs/architecture.md 6.5).
import type { EventKind, FaultKind, ObjectiveKind, PresetId, ScenarioId, SiteId } from '../types';

export type DirectorEvent = 'wind' | 'quake' | 'impact' | 'devil' | 'fault';

/** One scripted action. `near` places events relative to the crew, a station or the lander. */
export type BeatAction =
  | { kind: 'radio'; from: 'earth' | 'tulpar'; key: string }
  | { kind: 'event'; event: EventKind; near: 'crew' | 'station' | 'lander'; dist?: number }
  | { kind: 'flare'; leadS: number; durS: number }
  | { kind: 'storm' }
  | { kind: 'fault'; fault: FaultKind }
  | { kind: 'devil' }
  | { kind: 'act'; act: number }
  | { kind: 'window' };

export interface Beat {
  /** Mission time in seconds; each beat runs once when t >= at. */
  at: number;
  action: BeatAction;
}

/** A director act: from `from` seconds, events from `pool` (weight = max count) every gapS. */
export interface ActDef {
  from: number;
  gapS: [number, number];
  pool: Partial<Record<DirectorEvent, number>>;
}

/**
 * One mission objective. `target` is a number or comes from the mission:
 * 'quota' / 'deep' from the science goal, 'kits' from the design. Then `minus` is subtracted
 * and the result is raised to `min`. An objective whose target ends up at 0 is dropped.
 */
export interface ObjectiveSpec {
  kind: ObjectiveKind;
  primary: boolean;
  target: number | 'quota' | 'deep' | 'kits';
  minus?: number;
  min?: number;
}

export interface ScenarioDef {
  id: ScenarioId;
  durationS: number;
  /** End of dusk: light and solar output reach their night value. */
  duskEndS: number;
  /** Fixed seed for reproducible demos, or null to use the room seed. */
  seed: number | null;
  /** Forced landing site, or null to use the design. */
  site: SiteId | null;
  deployStations: boolean;
  /** Sample-site rings (1 near … 3 far) known at start; others become anomalies. */
  knownRings: number[];
  /** RED SIGNAL storyline on. */
  signal: boolean;
  /** Big world content: biome sites, lava tubes, supply caches, the rover. */
  bigWorld: boolean;
  scienceFull: number;
  quickPreset: PresetId;
  /** Scripted beats (training) and fixed story beats (signal). */
  beats: Beat[];
  /** Director acts; empty = no director (training, free). */
  acts: ActDef[];
  /** Mission objectives (docs/product-logic.md 5.1, 7.18). */
  objectives: ObjectiveSpec[];
}
