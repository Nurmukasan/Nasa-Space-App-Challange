// Digging mini-game (docs/product-logic.md 7.5.1).
import { describe, expect, it } from 'vitest';
import {
  CREW,
  DIG,
  DIG_GAME,
  PRESETS,
  TICK_DT,
  createRng,
  deriveParams,
  digComboMul,
  digMarker,
} from '../src';
import type { ClientMsg, CrewClassId, ScenarioId } from '../src';
import { diggingSystem } from '../src/sim/digging';
import { judgedPhase } from '../src/sim/digGame';
import { handleSimMsg } from '../src/sim/input';
import { createSim } from '../src/sim/sim';

function setup(scenario: ScenarioId = 'training', crewClass: CrewClassId = 'engineer') {
  const sim = createSim(deriveParams(PRESETS.balanced, 3, scenario), ['a'], [crewClass]);
  const a = sim.pub.astronauts[0]!;
  const site = sim.pub.sites.find((s) => s.kind !== 'impact' && s.kind !== 'signal')!;
  a.status = 'active';
  a.x = site.x;
  a.y = site.y;
  sim.pub.t = 1;
  const send = (msg: ClientMsg) => handleSimMsg(sim, 'a', true, false, msg);
  const strike = (phase: number) => send({ t: 'eva:strike', phase });
  /** Advance mission time with the digging system running, like the real tick. */
  const wait = (s: number) => {
    for (let k = 0; k < Math.round(s / TICK_DT); k++) {
      sim.pub.t += TICK_DT;
      diggingSystem(sim, TICK_DT);
    }
  };
  return { sim, a, site, send, strike, wait };
}

/** Put the zone under the marker, so a stroke at the marker is perfect. */
function aimAtMarker(g: ReturnType<typeof setup>): number {
  const phase = digMarker(g.a.dig!, g.sim.pub.t);
  g.a.dig!.zone = phase;
  return phase;
}

describe('digging mini-game', () => {
  it('the first SPACE starts the bar and digs nothing', () => {
    const g = setup();
    g.strike(0);
    expect(g.a.dig).not.toBeNull();
    expect(g.a.digging).toBe(true);
    expect(g.a.dig!.last).toBeNull();
    expect(g.site.depth).toBe(0);
  });

  it('a perfect stroke digs strokeS x 1.4 seconds of v1 digging', () => {
    const g = setup();
    g.strike(0);
    g.wait(0.5);
    g.strike(aimAtMarker(g));
    expect(g.a.dig!.last).toBe('perfect');
    expect(g.site.depth).toBeCloseTo(
      g.sim.params.digRate * DIG_GAME.strokeS * DIG_GAME.mul.perfect,
      6,
    );
  });

  it('good strokes in a row dig deeper; a miss costs O2, resets the run and locks longer', () => {
    const g = setup();
    g.strike(0);
    const depths: number[] = [];
    for (let i = 0; i < 6; i++) {
      g.wait(DIG_GAME.cooldownS + TICK_DT);
      const phase = digMarker(g.a.dig!, g.sim.pub.t);
      g.a.dig!.zone = phase + DIG_GAME.goodHalf * 0.8 * (phase < 0.5 ? 1 : -1);
      const before = g.site.depth;
      g.strike(phase);
      expect(g.a.dig!.last).toBe('good');
      depths.push(g.site.depth - before);
    }
    const unit = g.sim.params.digRate * DIG_GAME.strokeS;
    depths.forEach((d, i) => expect(d).toBeCloseTo(unit * digComboMul(i), 6));
    expect(g.a.dig!.combo).toBe(6);

    g.wait(DIG_GAME.cooldownS + TICK_DT);
    const o2 = g.a.o2;
    const phase = digMarker(g.a.dig!, g.sim.pub.t);
    g.a.dig!.zone = phase < 0.5 ? 0.95 : 0.05;
    g.strike(phase);
    expect(g.a.dig!.last).toBe('miss');
    expect(g.a.dig!.combo).toBe(0);
    expect(g.a.o2).toBeCloseTo(o2 - DIG_GAME.missO2, 6);
    expect(g.a.dig!.lockUntil).toBeCloseTo(g.sim.pub.t + DIG_GAME.missLockS, 6);
    const n = g.a.dig!.n;
    g.wait(DIG_GAME.cooldownS + TICK_DT);
    g.strike(digMarker(g.a.dig!, g.sim.pub.t));
    expect(g.a.dig!.n).toBe(n);
  });

  it('the geologist digs 30% deeper per stroke', () => {
    const depth = (crewClass: CrewClassId) => {
      const g = setup('training', crewClass);
      g.strike(0);
      g.wait(0.5);
      g.strike(aimAtMarker(g));
      return g.site.depth;
    };
    expect(depth('geologist')).toBeCloseTo(depth('engineer') * CREW.digMul.geologist, 6);
  });

  it('judges the marker the player saw only if it was there a moment ago', () => {
    const dig = { t0: 0, zone: 0.5, n: 0, combo: 0, lastT: 0, last: null, lockUntil: 0 };
    const t = 0.3;
    expect(judgedPhase(dig, t, 0.1)).toBe(0.1);
    expect(judgedPhase(dig, t, 0.9)).toBeCloseTo(digMarker(dig, t), 9);
    // The server judges at its last tick, a moment before the key press.
    const ahead = digMarker(dig, t + DIG_GAME.leadS * 0.9);
    expect(judgedPhase(dig, t, ahead)).toBe(ahead);
    // Long ago does not count either.
    expect(judgedPhase(dig, 2.7, 0.1)).toBeCloseTo(digMarker(dig, 2.7), 9);
  });

  it('ignores bad input and does nothing away from a site', () => {
    const g = setup();
    for (const phase of [Number.NaN, -0.1, 1.5, Infinity])
      handleSimMsg(g.sim, 'a', true, false, { t: 'eva:strike', phase });
    handleSimMsg(g.sim, 'a', true, false, { t: 'eva:strike', phase: '0.5' } as never);
    expect(g.a.dig).toBeNull();
    handleSimMsg(g.sim, 'a', false, true, { t: 'eva:strike', phase: 0.5 });
    expect(g.a.dig).toBeNull();
    g.a.x += DIG.reach + 30;
    g.strike(0.5);
    expect(g.a.dig).toBeNull();
  });

  it('holding SPACE does not dig in training; Free mission keeps v1 and ignores strokes', () => {
    const g = setup();
    g.send({ t: 'eva:dig', on: true });
    g.wait(2);
    expect(g.a.digging).toBe(false);
    expect(g.site.depth).toBe(0);

    const f = setup('free');
    f.strike(0.5);
    expect(f.a.dig).toBeNull();
    f.send({ t: 'eva:dig', on: true });
    f.wait(2);
    expect(f.site.depth).toBeCloseTo(f.sim.params.digRate * 2, 2);
  });

  it('a session ends on walking away, idling and full hands; strokes hand out samples', () => {
    const g = setup();
    g.strike(0);
    g.wait(DIG_GAME.idleS + 0.5);
    expect(g.a.dig).toBeNull();
    expect(g.a.digging).toBe(false);

    g.strike(0);
    g.send({ t: 'eva:move', x: g.a.x + 2, y: g.a.y, facing: 0, moving: true, running: false });
    expect(g.a.dig).toBeNull();

    g.strike(0);
    let strokes = 0;
    while (g.a.carrying.length === 0 && strokes < 40) {
      g.wait(DIG_GAME.cooldownS + TICK_DT);
      g.strike(aimAtMarker(g));
      strokes++;
    }
    expect(g.a.carrying[0]?.tier).toBe('surface');
    g.a.carrying.push({ ...g.a.carrying[0]! });
    g.wait(TICK_DT);
    expect(g.a.dig).toBeNull();
    g.strike(0);
    expect(g.a.dig).toBeNull();
  });

  it('skill sets the pace: aimed strokes beat v1 hold-SPACE, mashing is far slower', () => {
    const run = (style: 'aim' | 'mash') => {
      const g = setup();
      g.site.depth = 0;
      g.sim.params.maxDepth = 100;
      g.a.o2 = g.a.o2Max = 1e6;
      const rng = createRng(9);
      g.strike(0);
      const seconds = 30;
      for (let k = 0; k < seconds / TICK_DT; k++) {
        g.wait(TICK_DT);
        const dig = g.a.dig;
        if (!dig) {
          g.strike(0);
          continue;
        }
        const phase = digMarker(dig, g.sim.pub.t);
        if (style === 'mash') g.strike(rng.next());
        else if (Math.abs(phase - dig.zone) <= DIG_GAME.perfectHalf) g.strike(phase);
        g.site.taken = ['surface', 'deep', 'core'];
      }
      return g.site.depth / seconds / g.sim.params.digRate;
    };
    const aim = run('aim');
    const mash = run('mash');
    expect(aim).toBeGreaterThan(1.2);
    expect(mash).toBeLessThan(0.6);
    expect(aim).toBeGreaterThan(mash * 3);
  });
});
