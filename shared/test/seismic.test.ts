import { expect, it } from 'vitest';
import { PRESETS, SITES, deriveParams } from '../src';
import { createSim } from '../src/sim/sim';
import { seismicSystem } from '../src/sim/seismic';
import { launched } from './helpers';

it('builds deterministic, bounded schedules with the tutorial wind followed by a quake', () => {
  const run = (seed: number) =>
    createSim(deriveParams(PRESETS.balanced, seed), ['a']).hidden.schedule;
  expect(run(1)).toEqual(run(1));
  expect(run(1)).not.toEqual(run(2));
  for (const site of ['jezero', 'arcadia', 'elysium'] as const)
    for (let seed = 0; seed < 100; seed++) {
      const sim = createSim(deriveParams({ ...PRESETS.balanced, site }, seed), ['a']);
      const s = sim.hidden.schedule;
      expect(s[0]?.kind).toBe('wind');
      expect(s[0]!.t0).toBeGreaterThanOrEqual(75);
      expect(s[0]!.t0).toBeLessThanOrEqual(95);
      expect(s[1]?.kind).toBe('quake');
      expect(s[1]!.t0).toBeGreaterThanOrEqual(150);
      expect(s[1]!.t0).toBeLessThanOrEqual(190);
      expect(s.at(-1)!.t0).toBeLessThanOrEqual(540);
      for (let i = 1; i < s.length; i++) expect(s[i]!.t0 - s[i - 1]!.t0).toBeGreaterThanOrEqual(55);
      for (const [kind, count] of [
        ['quake', SITES[site].quakes],
        ['impact', SITES[site].impacts],
        ['wind', SITES[site].winds],
      ] as const)
        expect(s.filter((e) => e.kind === kind).length).toBeLessThanOrEqual(count);
    }
});
it('keeps truth private, delays waves by distance, and increases noise without scan power', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 1), ['a']);
  sim.hidden.schedule = [{ id: 'q', kind: 'quake', t0: 1, x: 768, y: 500, fired: false }];
  sim.pub.t = 1;
  seismicSystem(sim, 0);
  const e = sim.pub.seismic[0]!;
  expect(e.truth).toBeNull();
  expect(e.estimate).toBeNull();
  expect(e.signals).toHaveLength(3);
  expect(e.signals.every((s) => s.amp > 0)).toBe(true);
  expect(e.signals[0]!.delayS).toBeLessThan(e.signals[1]!.delayS);
  sim.hidden.schedule.push({ id: 'w', kind: 'wind', t0: 2, x: 768, y: 508, fired: false });
  sim.pub.lander.power.eff.scan = 0;
  sim.pub.t = 2;
  seismicSystem(sim, 0);
  const w = sim.pub.seismic[1]!;
  expect(w.signals.filter((s) => s.amp > 0)).toHaveLength(1);
  expect(w.signals[0]!.noise).toBeCloseTo(1.05);
});
it('debug injects each event one second ahead and impact has a prior fireball', () => {
  for (const kind of ['quake', 'impact', 'wind'] as const) {
    const { h, mc } = launched(1);
    h.seconds(5.1);
    const sim = h.room.simulation!;
    h.send(mc, { t: 'debug', cmd: `event_${kind}` });
    h.seconds(1.1);
    expect(sim.pub.seismic).toHaveLength(1);
    expect(sim.pub.fx.some((e) => e.type === (kind === 'impact' ? 'impact' : 'tremor'))).toBe(true);
  }
});

it('shows the fireball two seconds before impact without creating the crater early', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 1), ['a']);
  sim.hidden.schedule = [{ id: 'meteor', kind: 'impact', t0: 10, x: 700, y: 500, fired: false }];
  sim.pub.t = 7.9;
  seismicSystem(sim, 0);
  expect(sim.pub.fx).toHaveLength(0);
  sim.pub.t = 8;
  seismicSystem(sim, 0);
  expect(sim.pub.fx.map((e) => e.type)).toEqual(['fireball']);
  expect(sim.pub.seismic).toHaveLength(0);
  expect(sim.pub.sites.every((s) => s.kind !== 'impact')).toBe(true);
  seismicSystem(sim, 0);
  expect(sim.pub.fx).toHaveLength(1);
});

it('retains all unresolved events and only the last three resolved events', () => {
  const { h, mc } = launched(1);
  h.seconds(5.1);
  const sim = h.room.simulation!;
  for (let i = 0; i < 6; i++) {
    h.send(mc, { t: 'debug', cmd: 'event_wind' });
    h.seconds(1.1);
    h.send(mc, { t: 'mc:classify', eventId: sim.pub.seismic.at(-1)!.id, kind: 'wind' });
    h.ticks(1);
  }
  expect(sim.pub.seismic).toHaveLength(3);
  h.send(mc, { t: 'debug', cmd: 'event_quake' });
  h.seconds(1.1);
  expect(sim.pub.seismic).toHaveLength(4);
  expect(sim.pub.seismic.at(-1)!.truth).toBeNull();
});
