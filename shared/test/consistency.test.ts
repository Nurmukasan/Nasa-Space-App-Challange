// Engine consistency fixes from the v2 audit (docs/product-logic.md vs the code).
import { expect, it } from 'vitest';
import { PRESETS, deriveParams } from '../src';
import type { ScenarioId } from '../src';
import { createSim } from '../src/sim/sim';
import { stepSim } from '../src/sim/step';
import { endMission } from '../src/sim/endcheck';
import { handleSimMsg } from '../src/sim/input';
import { debugSim } from '../src/sim/debug';

function sim(scenario: ScenarioId = 'signal') {
  const s = createSim(deriveParams(PRESETS.balanced, 5, scenario), ['a', 'b']);
  s.pub.t = 10;
  return s;
}

it('liftoff is an effect and a timeline entry with the samples aboard (PL 7.21)', () => {
  const s = sim();
  for (const a of s.pub.astronauts) a.status = 'inside';
  s.pub.lander.cache.push({ siteId: 'S1', kind: 'delta', tier: 'surface', value: 10, by: 'a' });
  endMission(s);
  expect(s.pub.fx.find((f) => f.type === 'liftoff')?.n).toBe(1);
  expect(s.hidden.timeline.at(-1)).toMatchObject({ type: 'liftoff', n: 1 });
});

it('no liftoff when the whole crew is lost', () => {
  const s = sim();
  for (const a of s.pub.astronauts) a.status = 'lost';
  s.hidden.stats.lost = 2;
  endMission(s);
  expect(s.pub.fx.some((f) => f.type === 'liftoff')).toBe(false);
});

it('quick signals accept only the six kinds and carry the position (PL 7.11, 7.20)', () => {
  const s = sim();
  const a = s.pub.astronauts[0]!;
  handleSimMsg(s, 'a', true, false, { t: 'eva:ping', kind: 'shaking' });
  expect(s.pub.fx.at(-1)).toMatchObject({ type: 'ping', s: 'shaking', x: a.x, y: a.y });
  const n = s.pub.fx.length;
  handleSimMsg(s, 'a', true, false, { t: 'eva:ping', kind: 'nonsense' } as never);
  handleSimMsg(s, 'a', true, false, { t: 'eva:ping', kind: '__proto__' } as never);
  expect(s.pub.fx).toHaveLength(n);
});

it('Mission Control alerts need a known kind and a real astronaut', () => {
  const s = sim();
  const logs = s.pub.log.length;
  handleSimMsg(s, 'mc', false, true, { t: 'mc:alert', playerId: 'a', kind: 'evac' });
  expect(s.pub.log).toHaveLength(logs + 1);
  handleSimMsg(s, 'mc', false, true, { t: 'mc:alert', playerId: 'nobody', kind: 'evac' });
  handleSimMsg(s, 'mc', false, true, { t: 'mc:alert', playerId: 'a', kind: 'dance' } as never);
  expect(s.pub.log).toHaveLength(logs + 1);
});

it('free mission also counts per-crew oxygen and time outside for the awards', () => {
  const s = sim('free');
  for (let i = 0; i < 30; i++) stepSim(s, 1 / 15);
  const c = s.hidden.stats.crewStats[0]!;
  expect(c.secondsOutside).toBeGreaterThan(1.9);
  expect(c.o2Used).toBeGreaterThan(0);
});

it('debug next_act jumps to the next act and reveal_all opens every hidden site', () => {
  const s = sim('signal');
  debugSim(s, 'next_act');
  expect(s.pub.t).toBe(240);
  stepSim(s, 1 / 15);
  expect(s.pub.act).toBe(2);
  const hidden = s.hidden.hiddenSites.length;
  expect(hidden).toBeGreaterThan(0);
  const known = s.pub.sites.length;
  debugSim(s, 'reveal_all');
  expect(s.pub.sites).toHaveLength(known + hidden);
  expect(s.pub.anomalies).toHaveLength(0);
  expect(s.pub.signal.found).toBe(true);
});

it('debug next_act does nothing in scenarios without acts', () => {
  const s = sim('training');
  debugSim(s, 'next_act');
  expect(s.pub.t).toBe(10);
});

it('RED SIGNAL has a secondary locate_signal objective, done once the source is located', () => {
  const s = sim('signal');
  const o = s.pub.objectives.find((x) => x.kind === 'locate_signal')!;
  expect(o.primary).toBe(false);
  s.pub.signal.located = true;
  stepSim(s, 1 / 15);
  expect(o.state).toBe('done');
});
