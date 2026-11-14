import { describe, expect, it } from 'vitest';
import { SIGNALS } from '@rs/shared';
import { pressureAt, signalAt } from './Seismograph';
describe('station traces', () => {
  it('shows a wind pressure dip even when the station index is not zero', () => {
    const wind = {
      ...SIGNALS.wind,
      stationIdx: 2,
      delayS: 1,
      amp: 0.8,
      distEst: 0,
      bearingEst: null,
    };
    expect(pressureAt([wind], 12.5, 10)).toBeCloseTo(-0.8);
    expect(pressureAt([wind], 9, 10)).toBe(0);
    expect(pressureAt([{ ...wind, ...SIGNALS.quake }], 12.5, 10)).toBe(0);
  });
  it('uses deterministic event/station noise and no wave before arrival', () => {
    const signal = {
      ...SIGNALS.quake,
      stationIdx: 1,
      delayS: 1,
      amp: 0.8,
      distEst: 0,
      bearingEst: null,
    };
    expect(signalAt('Q1', signal, -1)).toBe(0);
    expect(signalAt('Q1', signal, 3)).toBe(signalAt('Q1', signal, 3));
    expect(signalAt('Q1', signal, 3)).not.toBe(signalAt('Q2', signal, 3));
  });
});
