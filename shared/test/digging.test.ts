import { expect, it } from 'vitest';
import { DIG, LANDER_POS, PRESETS, deriveParams } from '../src';
import { createSim } from '../src/sim/sim';
import { diggingSystem } from '../src/sim/digging';
import { handleSimMsg } from '../src/sim/input';

function setup(drill = false) {
  const sim = createSim(deriveParams(PRESETS[drill ? 'science' : 'balanced'], 1), ['a', 'b']);
  sim.pub.t = 0;
  const a = sim.pub.astronauts[0]!;
  const site = sim.pub.sites[0]!;
  Object.assign(a, { x: site.x, y: site.y, digging: true });
  return { sim, a, site };
}
it('shovel yields surface at four seconds and deep at twenty, stopping at one metre', () => {
  const { sim, a, site } = setup();
  diggingSystem(sim, 3.9);
  expect(a.carrying).toHaveLength(0);
  diggingSystem(sim, 0.1);
  expect(a.carrying.map((s) => s.tier)).toEqual(['surface']);
  diggingSystem(sim, 16);
  expect(a.carrying.map((s) => s.tier)).toEqual(['surface', 'deep']);
  a.carrying = [];
  handleSimMsg(sim, a.id, true, false, { t: 'eva:dig', on: true });
  diggingSystem(sim, 100);
  expect(site.depth).toBe(DIG.deepDepth);
});
it('drill reaches core after unloading and impact gives only a valuable surface sample', () => {
  const { sim, a, site } = setup(true);
  diggingSystem(sim, 6);
  a.carrying = [];
  handleSimMsg(sim, a.id, true, false, { t: 'eva:dig', on: true });
  diggingSystem(sim, 6);
  expect(a.carrying[0]?.tier).toBe('core');
  expect(site.depth).toBe(2);
  Object.assign(site, { kind: 'impact', taken: [], depth: 0 });
  a.carrying = [];
  handleSimMsg(sim, a.id, true, false, { t: 'eva:dig', on: true });
  diggingSystem(sim, 20);
  expect(a.carrying.map((s) => [s.tier, s.value])).toEqual([['surface', 72]]);
});
it('favored samples receive 1.5 times the value and score only on deposit', () => {
  const { sim, a, site } = setup();
  site.kind = sim.params.favoredKind;
  diggingSystem(sim, 4);
  expect(a.carrying[0]?.value).toBe(15);
  expect(sim.hidden.stats.scienceRaw).toBe(0);
  Object.assign(a, LANDER_POS);
  handleSimMsg(sim, a.id, true, false, { t: 'eva:interact' });
  expect(sim.hidden.stats.scienceRaw).toBe(15);
  expect(sim.hidden.stats.samplesDeposited).toBe(1);
});
it('full hands cannot advance excavation; another astronaut can continue the shared site', () => {
  const { sim, a, site } = setup();
  diggingSystem(sim, 20);
  Object.assign(site, { depth: 0, taken: [] });
  a.digging = true;
  diggingSystem(sim, 4);
  expect(a.carrying).toHaveLength(2);
  expect(site.depth).toBe(0);
  expect(a.digging).toBe(false);
  const b = sim.pub.astronauts[1]!;
  Object.assign(b, { x: site.x, y: site.y, digging: true });
  diggingSystem(sim, 4);
  expect(b.carrying[0]?.tier).toBe('surface');
  expect(site.taken).toEqual(['surface']);
});
it('inactive, distant and countdown astronauts cannot dig', () => {
  const { sim, a, site } = setup();
  sim.pub.t = -1;
  diggingSystem(sim, 10);
  expect(site.depth).toBe(0);
  sim.pub.t = 0;
  a.status = 'down';
  diggingSystem(sim, 10);
  expect(site.depth).toBe(0);
  a.status = 'active';
  a.x += 100;
  diggingSystem(sim, 10);
  expect(a.digging).toBe(false);
});

it('full hands block progress before any sample threshold without emitting sample effects', () => {
  const { sim, a, site } = setup();
  a.carrying = Array.from({ length: sim.params.carryCap }, (_, i) => ({
    siteId: `other-${i}`,
    kind: 'delta' as const,
    tier: 'surface' as const,
    value: 10,
    by: a.id,
  }));
  site.depth = 0.1;
  diggingSystem(sim, 1);
  expect(site.depth).toBe(0.1);
  expect(a.digging).toBe(false);
  expect(a.carrying).toHaveLength(sim.params.carryCap);
  expect(site.taken).toEqual([]);
  expect(sim.pub.fx).toEqual([]);
  expect(sim.pub.log).toEqual([]);
});

it('a tick that fills the last carrying slot stops exactly at that sample depth', () => {
  const { sim, a, site } = setup(true);
  a.carrying = [{ siteId: 'other', kind: 'delta', tier: 'surface', value: 10, by: a.id }];
  diggingSystem(sim, 60);
  expect(site.depth).toBe(DIG.surfaceDepth);
  expect(a.carrying).toHaveLength(sim.params.carryCap);
  expect(site.taken).toEqual(['surface']);
  expect(a.digging).toBe(false);
  expect(sim.pub.fx.filter((e) => e.type === 'sample')).toHaveLength(1);
});

it("two astronauts can continue each other's partial excavation without duplicate samples", () => {
  const { sim, a, site } = setup();
  diggingSystem(sim, 2);
  expect(site.depth).toBeCloseTo(0.1);
  expect(a.carrying).toHaveLength(0);
  a.digging = false;
  const b = sim.pub.astronauts[1]!;
  Object.assign(b, { x: site.x, y: site.y, digging: true });
  diggingSystem(sim, 2);
  expect(site.depth).toBeCloseTo(DIG.surfaceDepth);
  expect(a.carrying).toHaveLength(0);
  expect(b.carrying.map((s) => s.tier)).toEqual(['surface']);
  b.digging = false;
  a.digging = true;
  diggingSystem(sim, 16);
  expect(site.depth).toBeCloseTo(DIG.deepDepth);
  expect(a.carrying.map((s) => s.tier)).toEqual(['deep']);
  expect(site.taken).toEqual(['surface', 'deep']);
});
