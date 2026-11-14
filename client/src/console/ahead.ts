// "What's ahead" feed for Mission Control (docs/product-logic.md 7.8): only what the crew can know.
import type { EvaState, MissionParams } from '@rs/shared';

export const AHEAD = {
  /** How far ahead the feed looks, s. */
  horizonS: 120,
  /** A decision timer turns urgent (and beeps once) below this, s. */
  urgentS: 5,
};

export type AheadKind =
  | 'relay_open'
  | 'relay_close'
  | 'sunset'
  | 'storm'
  | 'storm_end'
  | 'flare'
  | 'flare_end'
  | 'window';
export interface AheadItem {
  at: number;
  kind: AheadKind;
}

/** Upcoming events within the horizon, soonest first. Pure: reads the public snapshot only. */
export function upcoming(
  s: EvaState,
  p: MissionParams,
  horizonS: number = AHEAD.horizonS,
): AheadItem[] {
  const now = Math.max(0, s.t);
  const out: AheadItem[] = [];
  const add = (at: number, kind: AheadKind) => {
    if (at > now && at <= now + horizonS) out.push({ at, kind });
  };
  if (p.relay === 'low_orbit') {
    // Passes repeat on a fixed period: list every change inside the horizon.
    let at = s.relay.nextChangeAt;
    let open = !s.relay.open;
    while (at <= now + horizonS && at > now) {
      add(at, open ? 'relay_open' : 'relay_close');
      at += open ? p.relayPassWindowS : p.relayPassPeriodS - p.relayPassWindowS;
      open = !open;
    }
  }
  add(p.duskEndS, 'sunset');
  const storm = s.weather.storm;
  if (storm) {
    add(storm.tStart, 'storm');
    add(storm.tEnd, 'storm_end');
  }
  if (s.flare) {
    add(s.flare.tStart, 'flare');
    add(s.flare.tEnd, 'flare_end');
  }
  add(p.durationS, 'window');
  return out.sort((a, b) => a.at - b.at);
}
