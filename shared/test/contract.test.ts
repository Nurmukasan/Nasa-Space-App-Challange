// Phase 0 contract (docs/phases.md, P0-A): new fields exist, free mission keeps v1 values.
import { expect, it } from 'vitest';
import {
  MISSION_DURATION_S,
  POWER,
  PRESETS,
  SCENARIOS,
  SCORE,
  STATIONS,
  checkDesign,
  deriveParams,
} from '../src';
import { createSim } from '../src/sim/sim';
import { makeRoom } from './helpers';

it('free mission params keep v1 values', () => {
  const p = deriveParams(PRESETS.balanced, 7);
  expect(p.scenario).toBe('free');
  expect(p.durationS).toBe(MISSION_DURATION_S);
  expect(p.duskEndS).toBe(POWER.duskEndS);
  expect(p.deployStations).toBe(false);
  expect(p.kits).toBe(0);
  expect(p.scienceFull).toBe(SCORE.scienceFull);
  expect(p.solo).toBe(false);
});

it('every scenario derives launchable params', () => {
  for (const sc of Object.values(SCENARIOS)) {
    const p = deriveParams(PRESETS.balanced, 1, sc.id);
    expect(p.durationS).toBe(sc.durationS);
    expect(p.kits).toBe(sc.deployStations ? STATIONS.kitsWithNet : 0);
    expect(checkDesign(PRESETS.balanced, sc.id).forecast.dataReturnPct).toBeGreaterThan(0);
  }
});

it('createSim fills every v2 field', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 3, 'signal'), ['a', 'b']);
  const pub = sim.pub;
  expect(pub.scenario).toBe('signal');
  expect(pub.act).toBe(1);
  expect(pub.anomalies).toHaveLength(5); // B1 replaces the phase-0 all-known stub.
  expect(pub.devils).toEqual([]);
  expect(pub.flare).toBeNull();
  expect(pub.signal).toEqual({
    zone: null,
    pulses: 0,
    located: false,
    found: false,
    retrieved: false,
  });
  expect(pub.lander.faults).toEqual([]);
  expect(pub.stations).toHaveLength(1); // lander-mounted station; kits deploy the rest
  expect(pub.astronauts.map((a) => a.kits)).toEqual([1, 1]);
  for (const a of pub.astronauts) {
    expect(a.repairing).toBeNull();
    expect(a.scan).toBeNull();
    expect(a.dose).toBe(0);
  }
  expect(sim.hidden.stats.crewStats.map((c) => c.id)).toEqual(['a', 'b']);
});

it('free mission still auto-places stations and deals no kits', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 3), ['a']);
  expect(sim.pub.stations).toHaveLength(3);
  expect(sim.pub.astronauts[0]!.kits).toBe(0);
});

it('lobby:scenario: host only, lobby or design only, valid ids only', () => {
  const h = makeRoom();
  const a = h.room.join({ name: 'A' });
  const b = h.room.join({ name: 'B' });
  if (!a.ok || !b.ok) throw new Error('join');
  h.send(b.playerId, { t: 'lobby:scenario', id: 'training' });
  expect(h.room.state.scenario).toBe('free');
  h.send(a.playerId, { t: 'lobby:scenario', id: 'nope' as never });
  expect(h.room.state.scenario).toBe('free');
  h.send(a.playerId, { t: 'lobby:scenario', id: 'training' });
  expect(h.room.state.scenario).toBe('training');
});

it('solo training launches with the fixed seed, forced site and solo flag', () => {
  const h = makeRoom(999);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:class', crewClass: 'geologist' });
  h.send(a.playerId, { t: 'lobby:scenario', id: 'training' });
  h.send(a.playerId, { t: 'lobby:start', quick: true });
  const p = h.room.state.params!;
  expect(p.seed).toBe(SCENARIOS.training.seed);
  expect(p.site).toBe('jezero');
  expect(p.solo).toBe(true);
  expect(p.durationS).toBe(240);
});
