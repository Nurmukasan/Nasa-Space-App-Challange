import { describe, expect, it } from 'vitest';
import { PRESETS, createSim, deriveParams } from '@rs/shared';
import type { MissionDesign } from '@rs/shared';
import { upcoming } from './ahead';

function snap(design: MissionDesign = PRESETS.balanced, scenario: 'free' | 'signal' = 'signal') {
  const params = deriveParams(design, 7, scenario);
  return { s: createSim(params, ['a']).pub, p: params };
}

describe('mission control "what is ahead" feed', () => {
  it('shows sunset and the launch window only once they are within two minutes', () => {
    const { s, p } = snap();
    s.t = 0;
    expect(upcoming(s, p).map((i) => i.kind)).not.toContain('sunset');
    s.t = p.duskEndS - 60;
    expect(upcoming(s, p).map((i) => i.kind)).toContain('sunset');
    s.t = p.durationS - 30;
    const items = upcoming(s, p);
    expect(items.map((i) => i.kind)).toEqual(['window']);
    expect(items[0]!.at).toBe(p.durationS);
  });

  it('lists the storm and flare only when they are public, soonest first', () => {
    const { s, p } = snap();
    s.t = 300;
    expect(upcoming(s, p).some((i) => i.kind === 'storm' || i.kind === 'flare')).toBe(false);
    s.weather.storm = { tStart: 340, tEnd: 400 };
    s.flare = { warnAt: 300, tStart: 320, tEnd: 360 };
    const items = upcoming(s, p);
    expect(items.map((i) => i.kind).slice(0, 2)).toEqual(['flare', 'storm']);
    expect(items.map((i) => i.kind)).toEqual(expect.arrayContaining(['flare_end', 'storm_end']));
    expect(items.every((i, n) => n === 0 || items[n - 1]!.at <= i.at)).toBe(true);
  });

  it('repeats low-orbit relay passes inside the horizon', () => {
    const design = { ...PRESETS.budget, relay: 'low_orbit' as const };
    const { s, p } = snap(design);
    s.t = 10;
    s.relay = { open: false, nextChangeAt: 60 };
    const relay = upcoming(s, p).filter((i) => i.kind.startsWith('relay'));
    expect(relay[0]).toEqual({ at: 60, kind: 'relay_open' });
    expect(relay[1]).toEqual({ at: 60 + p.relayPassWindowS, kind: 'relay_close' });
    expect(relay.every((i) => i.at <= 130)).toBe(true);
  });

  it('never lists relay passes without a low-orbit relay', () => {
    const { s, p } = snap({ ...PRESETS.budget, relay: 'none' });
    expect(upcoming(s, p).some((i) => i.kind.startsWith('relay'))).toBe(false);
  });
});
