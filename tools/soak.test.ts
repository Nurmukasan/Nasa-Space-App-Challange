// A12: headless bots play full missions in-process (docs/phases.md).
import { expect, it } from 'vitest';
import type { SeismicEvent } from '@rs/shared';
import { classifyBySignature, pickEpicentre } from './botBrain';
import { runMission } from './soak';

it('bots finish a RED SIGNAL mission deterministically and use the v2 systems', () => {
  const a = runMission({ seed: 15839, scenario: 'signal', crew: 2 });
  const b = runMission({ seed: 15839, scenario: 'signal', crew: 2 });
  expect(a.report.score).toEqual(b.report.score);
  const st = a.report.stats;
  expect(st.locatePicks).toBeGreaterThan(0);
  expect(st.stationsDeployed).toBeGreaterThan(0);
  expect(st.samplesDeposited).toBeGreaterThan(0);
  expect(a.signalLocatedAtS).not.toBeNull();
});

it('bots finish training and free missions', () => {
  for (const scenario of ['training', 'free'] as const) {
    const r = runMission({ seed: 3, scenario, crew: 2 });
    expect(r.report.scenario).toBe(scenario);
    expect(r.report.stats.samplesDeposited).toBeGreaterThan(0);
  }
});

const ev = (signals: Partial<SeismicEvent['signals'][number]>[]): SeismicEvent =>
  ({
    id: 'e',
    signals: signals.map((s, i) => ({
      stationIdx: i,
      delayS: 0,
      amp: 1,
      riseS: 3.5,
      decayS: 14,
      freqHz: 1.2,
      noise: 0.08,
      pressureDip: 0,
      distEst: 0,
      bearingEst: null,
      ...s,
    })),
  }) as SeismicEvent;

it('reads the signature like an operator', () => {
  expect(classifyBySignature(ev([{ riseS: 0.25 }]))).toBe('impact');
  expect(classifyBySignature(ev([{ riseS: 1.5, noise: 0.35, pressureDip: 0.8 }]))).toBe('wind');
  expect(classifyBySignature(ev([{}]))).toBe('quake');
});

it('places the pick where the station rings cross', () => {
  const truth = { x: 900, y: 600 };
  const stations = [
    { x: 768, y: 768 },
    { x: 600, y: 900 },
    { x: 1000, y: 950 },
  ];
  const e = ev(
    stations.map((s, i) => ({
      distEst: Math.hypot(truth.x - s.x, truth.y - s.y),
      bearingEst: i === 0 ? Math.atan2(truth.y - s.y, truth.x - s.x) : null,
    })),
  );
  const pick = pickEpicentre(e, stations)!;
  expect(Math.hypot(pick.x - truth.x, pick.y - truth.y)).toBeLessThan(6);
  // One station: bearing and distance alone.
  const one = pickEpicentre(ev([e.signals[0]!]), stations.slice(0, 1))!;
  expect(Math.hypot(one.x - truth.x, one.y - truth.y)).toBeLessThan(2);
});
