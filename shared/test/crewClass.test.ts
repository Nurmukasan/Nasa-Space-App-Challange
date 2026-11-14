import { describe, expect, it } from 'vitest';
import {
  CREW,
  CREW_CLASS_IDS,
  LAUNCH_COUNTDOWN_S,
  PRESETS,
  defaultCrewClass,
  deriveParams,
  fieldSpeed,
  isCrewClassId,
} from '../src';
import type { CrewClassId } from '../src';
import { createSim } from '../src/sim/sim';
import { diggingSystem } from '../src/sim/digging';
import { faultSystem, portPos, spawnFault } from '../src/sim/faults';
import { launched, makeRoom } from './helpers';

describe('crew classes (contract)', () => {
  it('lists four classes and validates ids', () => {
    expect(CREW_CLASS_IDS).toEqual(['engineer', 'scout', 'geologist', 'biologist']);
    expect(isCrewClassId('scout')).toBe(true);
    for (const bad of ['', 'pilot', '__proto__', 3, null, undefined, {}])
      expect(isCrewClassId(bad)).toBe(false);
  });

  it('hands out classes by slot and stays in range for odd input', () => {
    expect([0, 1, 2, 3, 4].map(defaultCrewClass)).toEqual([
      'engineer',
      'scout',
      'geologist',
      'biologist',
      'engineer',
    ]);
    expect(isCrewClassId(defaultCrewClass(-5))).toBe(true);
    expect(isCrewClassId(defaultCrewClass(2.7))).toBe(true);
  });

  it('gives every joining player a class', () => {
    const h = makeRoom();
    const join = (name: string) => {
      const r = h.room.join({ name });
      if (!r.ok) throw new Error('join failed');
      return r.playerId;
    };
    const a = join('A');
    const b = join('B');
    const players = h.room.state.players;
    expect(players.find((p) => p.id === a)!.crewClass).toBe('engineer');
    expect(players.find((p) => p.id === b)!.crewClass).toBe('scout');
    expect(players.every((p) => p.classChosen === false)).toBe(true);
  });
});

describe('crew class choice and perks', () => {
  function lobby(n: number) {
    const h = makeRoom();
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const r = h.room.join({ name: `P${i}` });
      if (!r.ok) throw new Error('join failed');
      ids.push(r.playerId);
    }
    return { h, ids };
  }
  const info = (h: ReturnType<typeof makeRoom>, id: string) =>
    h.room.state.players.find((p) => p.id === id)!;

  it('lets a player pick a class in the lobby and carries it into the mission', () => {
    const { h, ids } = lobby(3);
    const [mc, a, b] = ids as [string, string, string];
    h.send(mc, { t: 'lobby:role', role: 'mc' });
    h.send(a, { t: 'lobby:role', role: 'eva' });
    h.send(b, { t: 'lobby:role', role: 'eva' });
    h.send(a, { t: 'lobby:class', crewClass: 'biologist' });
    h.send(b, { t: 'lobby:class', crewClass: 'pilot' as never });
    expect(info(h, a).crewClass).toBe('biologist');
    expect(info(h, b).crewClass).toBe('geologist');
    h.send(mc, { t: 'lobby:start', quick: true });
    h.ticks(1);
    const snap = h.lastSnap()!;
    expect(snap.astronauts.find((x) => x.id === a)!.crewClass).toBe('biologist');
    expect(snap.astronauts.find((x) => x.id === b)!.crewClass).toBe('geologist');
    // Locked once the crew is outside.
    h.send(a, { t: 'lobby:class', crewClass: 'scout' });
    expect(info(h, a).crewClass).toBe('biologist');
  });

  it('gives each class its perk', () => {
    expect(CREW.speedMul.scout).toBeGreaterThan(1);
    expect(CREW.digMul.geologist).toBeGreaterThan(1);
    expect(CREW.repairMul.engineer).toBeGreaterThan(1);
    expect(CREW.sampleMul.biologist).toBeGreaterThan(1);
    const { h } = launched(1);
    h.seconds(LAUNCH_COUNTDOWN_S + 0.5);
    const snap = h.lastSnap()!;
    const params = h.room.state.params!;
    const a = snap.astronauts[0]!;
    const base = fieldSpeed(params, snap, a.x, a.y, false, 'engineer');
    expect(fieldSpeed(params, snap, a.x, a.y, false, 'scout')).toBeCloseTo(
      base * CREW.speedMul.scout,
    );
  });

  it('geologist digs faster and biologist samples are worth more', () => {
    const dig = (crewClass: CrewClassId) => {
      const sim = createSim(deriveParams(PRESETS.balanced, 7), ['p1'], [crewClass]);
      const a = sim.pub.astronauts[0]!;
      const site = sim.pub.sites.find((s) => s.kind !== 'impact' && s.kind !== 'signal')!;
      a.x = site.x;
      a.y = site.y;
      a.digging = true;
      sim.pub.t = 1;
      diggingSystem(sim, 1);
      return { depth: site.depth, sim, site };
    };
    const geo = dig('geologist');
    const eng = dig('engineer');
    expect(eng.depth).toBeGreaterThan(0);
    expect(geo.depth).toBeCloseTo(eng.depth * CREW.digMul.geologist);
    const bio = dig('biologist');
    bio.site.depth = 0.5;
    diggingSystem(bio.sim, 0.01);
    const other = dig('scout');
    other.site.depth = 0.5;
    diggingSystem(other.sim, 0.01);
    const v = (s: typeof bio.sim) => s.pub.astronauts[0]!.carrying[0]!.value;
    expect(v(other.sim)).toBeGreaterThan(0);
    expect(v(bio.sim)).toBe(Math.round(v(other.sim) * CREW.sampleMul.biologist));
  });

  it('engineer repairs faults faster', () => {
    const repair = (crewClass: CrewClassId) => {
      const sim = createSim(deriveParams(PRESETS.balanced, 3, 'signal'), ['p1'], [crewClass]);
      sim.pub.t = 10;
      spawnFault(sim, 'moxie_clog');
      const fault = sim.pub.lander.faults[0]!;
      const a = sim.pub.astronauts[0]!;
      Object.assign(a, { ...portPos(fault.port), moving: false, repairing: fault.id });
      faultSystem(sim, 1);
      return fault.progress;
    };
    expect(repair('scout')).toBeGreaterThan(0);
    expect(repair('engineer')).toBeCloseTo(repair('scout') * CREW.repairMul.engineer);
  });
});
