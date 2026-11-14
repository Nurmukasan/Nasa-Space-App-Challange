// Shapes of scenario data. A scenario is data, not code (docs/architecture.md 6.5).
import type { EventKind, FaultKind, PresetId, ScenarioId, SiteId } from '../types';

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
  scienceFull: number;
  quickPreset: PresetId;
  /** Scripted beats (training) and fixed story beats (signal). */
  beats: Beat[];
  /** Director acts; empty = no director (training, free). */
  acts: ActDef[];
}
