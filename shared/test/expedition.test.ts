// Big world rules (v2.1): rover, supply caches, lava tubes, biomes.
import { expect, it } from 'vitest';
import {
  BIOME,
  CACHES,
  FLARE,
  LANDER_POS,
  MOVE,
  O2,
  PRESETS,
  ROVER,
  SAND,
  SITES,
  TICK_DT,
  WORLD,
  biomeAt,
  deriveParams,
  inCave,
  sandAt,
  terrainMul,
  tubeDistance,
  worldFor,
} from '../src';
import type { BiomeId, ClientMsg, Vec2 } from '../src';
import { createSim } from '../src/sim/sim';
import { stepSim } from '../src/sim/step';
import { handleSimMsg } from '../src/sim/input';
import { commsSystem } from '../src/sim/comms';
import { scheduleFlare } from '../src/sim/flare';
import { roverSpeed } from '../src/sim/expedition';

function mission(ids = ['a', 'b'], site: 'jezero' | 'elysium' | 'arcadia' = 'elysium') {
  const s = createSim(deriveParams({ ...PRESETS.science, site }, 4, 'signal'), ids);
  s.pub.t = 10;
  for (const a of s.pub.astronauts) a.status = 'active';
  return s;
}
type Sim = ReturnType<typeof mission>;
const astro = (s: Sim, id: string) => s.pub.astronauts.find((a) => a.id === id)!;
const eva = (s: Sim, id: string, msg: ClientMsg) => handleSimMsg(s, id, true, false, msg);
const steps = (s: Sim, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) stepSim(s, TICK_DT);
};
/** A point at `r` px from the lander inside `biome`. */
function pointIn(salt: number, biome: BiomeId, r = 2000, pred = (_p: Vec2) => true): Vec2 {
  for (let a = 0; a < 720; a++) {
    const p = {
      x: LANDER_POS.x + Math.cos((a * Math.PI) / 360) * r,
      y: LANDER_POS.y + Math.sin((a * Math.PI) / 360) * r,
    };
    if (biomeAt(p.x, p.y, salt) === biome && pred(p)) return p;
  }
  throw new Error(`no ${biome}`);
}

it('free mission has no rover, caches or tubes rules to speak of', () => {
  const s = createSim(deriveParams(PRESETS.balanced, 4), ['a']);
  expect(s.pub.rover).toBeNull();
  expect(s.pub.caches).toEqual([]);
  expect(s.pub.astronauts[0]!.inRover).toBe(false);
});

it('E boards a parked rover nearby and gets out again; one seat', () => {
  const s = mission();
  const rover = s.pub.rover!;
  const a = astro(s, 'a'),
    b = astro(s, 'b');
  Object.assign(a, { x: rover.x + 12, y: rover.y });
  eva(s, 'a', { t: 'eva:interact' });
  expect(a.inRover).toBe(true);
  expect(rover.driver).toBe('a');
  expect([a.x, a.y]).toEqual([rover.x, rover.y]);
  Object.assign(b, { x: rover.x + 5, y: rover.y });
  eva(s, 'b', { t: 'eva:interact' });
  expect(b.inRover).toBe(false);
  eva(s, 'a', { t: 'eva:interact' });
  expect(a.inRover).toBe(false);
  expect(rover.driver).toBeNull();
  expect(Math.hypot(a.x - rover.x, a.y - rover.y)).toBeCloseTo(ROVER.exitOffset, 5);
});

it('the rover drives ~2.7x faster than walking and drains its battery', () => {
  const s = mission();
  const rover = s.pub.rover!;
  const a = astro(s, 'a');
  Object.assign(a, { x: rover.x, y: rover.y });
  eva(s, 'a', { t: 'eva:interact' });
  const from = { x: a.x, y: a.y };
  const legal = roverSpeed(s.params, s.pub, a.x, a.y) * TICK_DT * MOVE.slack;
  eva(s, 'a', { t: 'eva:move', x: a.x + 500, y: a.y, facing: 0, moving: true, running: true });
  const moved = Math.hypot(a.x - from.x, a.y - from.y);
  expect(moved).toBeCloseTo(legal, 5);
  expect(moved).toBeGreaterThan(s.params.walkSpeed * TICK_DT * MOVE.slack * 2);
  expect([rover.x, rover.y]).toEqual([a.x, a.y]);
  expect(rover.charge).toBeCloseTo(1 - moved / ROVER.rangePx, 6);
  expect(s.hidden.stats.roverDistance).toBeCloseTo(moved, 6);
  // Empty battery: the rover does not move.
  rover.charge = 0;
  s.pub.t += 0.5;
  const stuck = { x: a.x, y: a.y };
  eva(s, 'a', { t: 'eva:move', x: a.x + 50, y: a.y, facing: 0, moving: true, running: false });
  expect([a.x, a.y]).toEqual([stuck.x, stuck.y]);
});

it('a parked rover recharges at the lander, not out in the field', () => {
  const s = mission();
  const rover = s.pub.rover!;
  rover.charge = 0.5;
  steps(s, 3);
  expect(rover.charge).toBeCloseTo(0.5 + 3 / ROVER.rechargeS, 2);
  Object.assign(rover, { x: LANDER_POS.x + 900, charge: 0.5 });
  steps(s, 3);
  expect(rover.charge).toBe(0.5);
});

it('the cabin supplies air, shields from the flare and from rockfall', () => {
  const s = mission();
  const rover = s.pub.rover!;
  const a = astro(s, 'a'),
    b = astro(s, 'b');
  Object.assign(a, { x: rover.x, y: rover.y });
  eva(s, 'a', { t: 'eva:interact' });
  Object.assign(b, { x: LANDER_POS.x - 200, y: LANDER_POS.y });
  const o2 = a.o2;
  scheduleFlare(s, s.pub.t, 0.5, FLARE.durS);
  steps(s, 4);
  expect(a.o2).toBe(o2);
  expect(a.dose).toBe(0);
  expect(b.dose).toBeGreaterThan(0);
});

it('lava tubes: shelter from the flare, no radio, no storm slowdown; rims stop walkers', () => {
  const s = mission(['a', 'b']);
  const tube = worldFor(s.salt).tubes[0]!;
  const floor = tube.points[Math.floor(tube.points.length / 2)]!;
  const a = astro(s, 'a'),
    b = astro(s, 'b');
  Object.assign(a, { x: floor.x, y: floor.y });
  // b stands on open ground well away from the tube.
  const open = pointIn(s.salt, 'lava', 1300, (p) => !inCave(p.x, p.y, s.salt));
  Object.assign(b, open);
  // Park the linked rover between them so radio would otherwise reach both.
  const rover = s.pub.rover!;
  Object.assign(rover, { x: LANDER_POS.x + 100, y: LANDER_POS.y });
  scheduleFlare(s, s.pub.t, 0.5, FLARE.durS);
  steps(s, 3);
  expect(a.dose).toBe(0);
  expect(b.dose).toBeGreaterThan(0);
  expect(a.linked).toBe(false);
  // Storm: full speed under rock.
  s.hidden.storm = { tStart: s.pub.t - 1, tEnd: s.pub.t + 60 };
  steps(s, TICK_DT);
  expect(terrainMul(s.pub, s.salt, a.x, a.y)).toEqual({ speed: 1, o2: 1, o2Extra: 0 });
  // Rim: a walker cannot cut through the rock into the tube.
  const i = 1;
  const p = tube.points[i]!,
    q = tube.points[i + 1]!;
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  const n = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
  const side = tube.entrances.every(
    (e) => Math.hypot(p.x + n.x * 50 - e.x, p.y + n.y * 50 - e.y) > WORLD.entranceR * 3,
  )
    ? 1
    : -1;
  const start = tube.halfWidth + WORLD.rimPx + 10;
  Object.assign(b, { x: p.x + n.x * start * side, y: p.y + n.y * start * side, status: 'active' });
  s.hidden.lastMoveT['b'] = s.pub.t - 0.5;
  eva(s, 'b', { t: 'eva:move', x: p.x, y: p.y, facing: 0, moving: true, running: false });
  expect(tubeDistance(tube, b.x, b.y)).toBeGreaterThanOrEqual(tube.halfWidth + WORLD.rimPx - 0.01);
});

it('the rover relays radio for crew near it while it is within reach of home', () => {
  const s = mission(['a', 'b']);
  s.pub.lander.power.eff.comms = 1;
  const range = s.params.commsRange;
  const rover = s.pub.rover!;
  const a = astro(s, 'a');
  const dir = { x: 1, y: 0 };
  Object.assign(rover, { x: LANDER_POS.x + dir.x * range * 2, y: LANDER_POS.y });
  Object.assign(a, { x: rover.x + range * 0.8, y: rover.y });
  commsSystem(s, TICK_DT);
  expect(a.linked).toBe(true);
  Object.assign(rover, { x: LANDER_POS.x + range * (ROVER.antennaMul + 0.5), y: LANDER_POS.y });
  Object.assign(a, { x: rover.x + 10, y: rover.y });
  commsSystem(s, TICK_DT);
  expect(a.linked).toBe(false);
});

it('E at a supply cache tops the suit up from the depot until it runs dry', () => {
  const s = mission(['a', 'b']);
  const cache = s.pub.caches[0]!;
  const a = astro(s, 'a'),
    b = astro(s, 'b');
  Object.assign(a, { x: cache.x + 5, y: cache.y, o2: 10, leak: true });
  eva(s, 'a', { t: 'eva:interact' });
  expect(a.o2).toBe(a.o2Max);
  expect(a.leak).toBe(false);
  expect(cache.o2).toBe(CACHES.o2 - (a.o2Max - 10));
  // b drains whatever is left over several visits; an empty depot gives nothing.
  Object.assign(b, { x: cache.x - 5, y: cache.y });
  let refills = 1;
  while (cache.o2 > 0) {
    b.o2 = 0.5;
    eva(s, 'b', { t: 'eva:interact' });
    refills++;
  }
  expect(cache.o2).toBe(0);
  b.o2 = 1;
  eva(s, 'b', { t: 'eva:interact' });
  expect(b.o2).toBe(1);
  expect(s.hidden.stats.cacheRefills).toBe(refills);
});

it('first steps into a biome are announced once and counted', () => {
  const s = mission(['a']);
  const a = astro(s, 'a');
  Object.assign(a, pointIn(s.salt, 'ice', 1600));
  steps(s, 1);
  steps(s, 1);
  expect(s.hidden.stats.biomesVisited).toEqual(['ice']);
  expect(s.hidden.timeline.filter((e) => e.type === 'biome')).toHaveLength(1);
  expect(s.pub.log.some((l) => l.key === 'log.biome.ice')).toBe(true);
});

it('dunes are soft sand, the ice field costs more oxygen, the lava flows are rough', () => {
  const salt = SITES.elysium.terrainSalt;
  const s = mission(['a']);
  const dune = pointIn(salt, 'dunes', 2000, (p) => sandAt(p.x, p.y, salt, true));
  expect(terrainMul(s.pub, salt, dune.x, dune.y).speed).toBeCloseTo(SAND.speedMul, 6);
  const ice = pointIn(salt, 'ice', 2000, (p) => !sandAt(p.x, p.y, salt, true));
  expect(terrainMul(s.pub, salt, ice.x, ice.y).o2).toBeCloseTo(BIOME.iceO2Mul, 6);
  const lava = pointIn(
    salt,
    'lava',
    1300,
    (p) => !sandAt(p.x, p.y, salt, true) && !inCave(p.x, p.y, salt),
  );
  expect(terrainMul(s.pub, salt, lava.x, lava.y).speed).toBeCloseTo(BIOME.lavaSpeedMul, 6);
});

it('the big-world snapshot stays under 16 KB with three astronauts', () => {
  const s = mission(['a', 'b', 'c']);
  steps(s, 5);
  expect(JSON.stringify(s.pub).length).toBeLessThan(16000);
  expect(O2.airlockRadius).toBeLessThan(Math.hypot(ROVER.parkOffset.x, ROVER.parkOffset.y));
});
