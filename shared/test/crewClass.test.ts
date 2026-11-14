import { describe, expect, it } from 'vitest';
import { CREW_CLASS_IDS, defaultCrewClass, isCrewClassId } from '../src';
import { makeRoom } from './helpers';

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
  });
});
