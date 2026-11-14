import { describe, expect, it } from 'vitest';
import { LANDER_POS, LAUNCH_COUNTDOWN_S, O2, TICK_DT } from '../src';
import type { ClientMsg } from '../src';
import { launched, makeRoom } from './helpers';

describe('lobby', () => {
  it('first player is host, roles are validated', () => {
    const h = makeRoom();
    const a = h.room.join({ name: 'A' });
    const b = h.room.join({ name: 'B' });
    if (!a.ok || !b.ok) throw new Error('join');
    expect(h.room.state.hostId).toBe(a.playerId);
    h.send(a.playerId, { t: 'lobby:role', role: 'mc' });
    h.send(b.playerId, { t: 'lobby:role', role: 'mc' });
    expect(h.room.state.players.map((p) => p.role)).toEqual(['mc', null]);
    h.send(b.playerId, { t: 'lobby:start', quick: true });
    expect(h.room.state.phase).toBe('lobby'); // not host, roles incomplete
    h.send(b.playerId, { t: 'lobby:role', role: 'eva' });
    h.send(b.playerId, { t: 'lobby:class', crewClass: 'scout' });
    h.send(a.playerId, { t: 'lobby:start', quick: true });
    expect(h.room.state.phase).toBe('eva');
  });

  it('solo player can start alone', () => {
    const h = makeRoom();
    const a = h.room.join({ name: 'A' });
    if (!a.ok) throw new Error('join');
    h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
    h.send(a.playerId, { t: 'lobby:class', crewClass: 'geologist' });
    h.send(a.playerId, { t: 'lobby:start', quick: true });
    expect(h.room.state.phase).toBe('eva');
    expect(h.room.simulation!.pub.astronauts).toHaveLength(1);
  });

  it('rejects a fifth player and late joiners, allows reconnect by token', () => {
    const h = makeRoom();
    const joins = [0, 1, 2, 3].map((i) => h.room.join({ name: `P${i}` }));
    expect(h.room.join({ name: 'X' })).toEqual({ ok: false, error: 'room_full' });
    const first = joins[0]!;
    if (!first.ok) throw new Error('join');
    const { h: h2, crew } = launched(1);
    expect(h2.room.join({ name: 'late' })).toEqual({ ok: false, error: 'game_in_progress' });
    h2.room.disconnect(crew[0]!);
    expect(h2.room.state.players.find((p) => p.id === crew[0])!.connected).toBe(false);
  });
});

describe('eva', () => {
  it('countdown blocks movement, then moves are accepted and clamped', () => {
    const { h, crew } = launched(1);
    const id = crew[0]!;
    const start = { ...h.room.simulation!.pub.astronauts[0]! };
    h.send(id, {
      t: 'eva:move',
      x: start.x + 5,
      y: start.y,
      facing: 0,
      moving: true,
      running: false,
    });
    expect(h.room.simulation!.pub.astronauts[0]!.x).toBe(start.x);
    h.seconds(LAUNCH_COUNTDOWN_S + 0.2);
    h.send(id, {
      t: 'eva:move',
      x: start.x + 9999,
      y: start.y,
      facing: 0,
      moving: true,
      running: true,
    });
    const a = h.room.simulation!.pub.astronauts[0]!;
    expect(a.x).toBeGreaterThan(start.x);
    expect(a.x - start.x).toBeLessThan(40); // teleport clamped to a legal step
  });

  it('oxygen drains, blackout at zero, then lost', () => {
    const { h, crew } = launched(1);
    h.seconds(LAUNCH_COUNTDOWN_S + 1);
    const a = h.room.simulation!.pub.astronauts[0]!;
    expect(a.o2).toBeLessThan(a.o2Max);
    a.o2 = 0.01;
    h.ticks(2);
    expect(a.status).toBe('down');
    h.seconds(O2.downSeconds + 1);
    expect(h.room.state.phase).toBe('report'); // only astronaut lost -> mission over
    expect(h.room.state.report!.stats.lost).toBe(1);
    expect(crew).toHaveLength(1);
  });

  it('refill at the airlock takes oxygen from the store', () => {
    const { h, crew } = launched(1);
    h.seconds(LAUNCH_COUNTDOWN_S + 0.2);
    const sim = h.room.simulation!;
    const a = sim.pub.astronauts[0]!;
    a.x = LANDER_POS.x + 10;
    a.y = LANDER_POS.y;
    a.o2 = 10;
    const store = sim.pub.lander.o2Store;
    h.send(crew[0]!, { t: 'eva:interact' });
    h.seconds(4);
    expect(a.o2).toBeGreaterThan(a.o2Max * 0.9);
    expect(sim.pub.lander.o2Store).toBeLessThan(store);
  });

  it('RATION mode: refill waits for mission control to dispense', () => {
    const { h, mc, crew } = launched(1);
    h.seconds(LAUNCH_COUNTDOWN_S + 0.2);
    const sim = h.room.simulation!;
    const a = sim.pub.astronauts[0]!;
    a.x = LANDER_POS.x + 10;
    a.y = LANDER_POS.y;
    a.o2 = 10;
    h.send(crew[0]!, { t: 'mc:ration', on: true }); // not MC: ignored
    expect(sim.pub.lander.ration).toBe(false);
    h.send(mc, { t: 'mc:ration', on: true });
    h.send(crew[0]!, { t: 'eva:interact' });
    h.seconds(2);
    expect(a.wantsRefill).toBe(true);
    expect(a.o2).toBeLessThan(10);
    h.send(mc, { t: 'mc:dispense', playerId: crew[0]! });
    h.seconds(4);
    expect(a.o2).toBeGreaterThan(a.o2Max * 0.9);
    expect(a.refillGranted).toBe(false);
  });

  it('sheltering inside does not end the mission', () => {
    const { h, crew } = launched(1);
    h.seconds(LAUNCH_COUNTDOWN_S + 0.2);
    const a = h.room.simulation!.pub.astronauts[0]!;
    a.x = LANDER_POS.x + 10;
    a.y = LANDER_POS.y;
    h.send(crew[0]!, { t: 'eva:interact' });
    expect(a.status).toBe('inside');
    const o2 = a.o2;
    h.seconds(5);
    expect(h.room.state.phase).toBe('eva');
    expect(a.o2).toBe(o2);
    h.send(crew[0]!, { t: 'eva:interact' });
    expect(a.status).toBe('active');
  });

  it('only mission control can lift off; report follows', () => {
    const { h, mc, crew } = launched(2);
    h.seconds(LAUNCH_COUNTDOWN_S + 1);
    h.send(crew[0]!, { t: 'mc:liftoff' });
    expect(h.room.state.phase).toBe('eva');
    h.send(mc, { t: 'mc:liftoff' });
    h.ticks(1);
    expect(h.room.state.phase).toBe('report');
    expect(Number.isFinite(h.room.state.report!.score.total)).toBe(true);
    h.send(mc, { t: 'report:again', redesign: true });
    expect(h.room.state.phase).toBe('design');
  });
});

describe('robustness', () => {
  it('is deterministic for the same seed and inputs', () => {
    const run = (): string => {
      const { h, mc, crew } = launched(2, 777);
      h.seconds(LAUNCH_COUNTDOWN_S);
      for (let i = 0; i < 300; i++) {
        const a = h.room.simulation!.pub.astronauts[i % 2]!;
        h.send(crew[i % 2]!, {
          t: 'eva:move',
          x: a.x + 2,
          y: a.y + (i % 3) - 1,
          facing: 0,
          moving: true,
          running: i % 5 === 0,
        });
        if (i === 100) h.send(mc, { t: 'mc:power', alloc: { moxie: 2, comms: 1, scan: 1 } });
        h.ticks(1);
      }
      return JSON.stringify(h.room.simulation!.pub);
    };
    expect(run()).toBe(run());
  });

  it('never throws on garbage input', () => {
    const { h, mc, crew } = launched(2);
    h.seconds(LAUNCH_COUNTDOWN_S + 0.5);
    const junk: unknown[] = [
      null,
      42,
      'x',
      {},
      { t: 5 },
      { t: 'eva:move' },
      { t: 'eva:move', x: NaN, y: Infinity, facing: 'a' },
      { t: 'mc:power', alloc: { moxie: -1, comms: 'x' } },
      { t: 'mc:power' },
      { t: 'mc:waypoint', playerId: {}, x: 1e99, y: -1e99 },
      { t: 'design:set', field: '__proto__', value: 'constructor' },
      { t: 'design:module', id: 'toString', on: true },
      { t: 'eva:ping', kind: { a: 1 } },
      { t: 'mc:classify' },
      { t: 'mc:classify', eventId: {}, kind: 'quake' },
      { t: 'mc:classify', eventId: 'E1', kind: '__proto__' },
      { t: 'mc:classify', eventId: 'E1', kind: null },
      { t: 'lobby:scenario' },
      { t: 'lobby:class' },
      { t: 'lobby:class', crewClass: '__proto__' },
      { t: 'lobby:class', crewClass: { x: 1 } },
      { t: 'lobby:scenario', id: '__proto__' },
      { t: 'lobby:scenario', id: { x: 1 } },
      { t: 'mc:locate' },
      { t: 'mc:locate', eventId: {}, x: NaN, y: 'a' },
      { t: 'mc:locate', eventId: 'E1', x: 1e99, y: -1e99 },
      { t: 'eva:ping', kind: 'shaking' },
      { t: 'debug', cmd: 'event_signal' },
      { t: 'debug', cmd: 'devil', n: NaN },
      { t: 'debug', cmd: 'fault' },
      { t: 'debug', cmd: 'flare' },
      { t: 'debug', cmd: 'next_act' },
      { t: 'debug', cmd: 'reveal_all' },
      { t: 'debug', cmd: '__proto__' },
      { t: 'nope' },
    ];
    for (const j of junk) {
      expect(() => h.room.handle(mc, j)).not.toThrow();
      expect(() => h.room.handle(crew[0]!, j)).not.toThrow();
      expect(() => h.room.handle('ghost', j)).not.toThrow();
    }
    h.ticks(5);
    expect(() => JSON.stringify(h.room.simulation!.pub)).not.toThrow();
  });

  it('full mission with random-walking crew ends in a report; snapshots stay small', () => {
    const { h, crew } = launched(3, 99);
    let maxBytes = 0;
    let guard = 0;
    const t0 = Date.now();
    while (h.room.state.phase === 'eva' && guard++ < 15 * 700) {
      const sim = h.room.simulation!;
      crew.forEach((id, i) => {
        const a = sim.pub.astronauts[i]!;
        const ang = (guard / 40 + i * 2) % (Math.PI * 2);
        const m: ClientMsg = {
          t: 'eva:move',
          x: a.x + Math.cos(ang) * 2.5,
          y: a.y + Math.sin(ang) * 2.5,
          facing: ang,
          moving: true,
          running: false,
        };
        h.send(id, m);
        if (guard % 150 === 0) h.send(id, { t: 'eva:interact' });
      });
      h.ticks(1);
      if (guard % 50 === 0) maxBytes = Math.max(maxBytes, JSON.stringify(h.lastSnap()).length);
    }
    const msPerTick = (Date.now() - t0) / guard;
    expect(h.room.state.phase).toBe('report');
    expect(maxBytes).toBeLessThan(16_000);
    expect(msPerTick).toBeLessThan(2);
    expect(TICK_DT).toBeCloseTo(1 / 15);
  });
});
