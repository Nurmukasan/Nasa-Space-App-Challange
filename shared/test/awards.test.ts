// A9: crew awards and the per-crew counters behind them (docs/product-logic.md 8.4).
import { expect, it } from 'vitest';
import { AWARDS, PRESETS, deriveParams } from '../src';
import { buildAwards } from '../src/sim/awards';
import { createSim } from '../src/sim/sim';
import { launched } from './helpers';

function crew(n = 3) {
  const sim = createSim(
    deriveParams(PRESETS.balanced, 1, 'signal'),
    Array.from({ length: n }, (_, i) => `p${i}`),
  );
  return { sim, c: sim.hidden.stats.crewStats };
}

it('gives each award to the single best astronaut, at most one award per player', () => {
  const { sim, c } = crew();
  c[0]!.science = 90;
  c[0]!.distance = 900; // best walker too, but already holds rock_hound
  c[1]!.science = 40;
  c[1]!.distance = 500;
  c[2]!.repairs = 1;
  const awards = buildAwards(sim, null);
  expect(awards).toEqual([
    { code: 'rock_hound', playerId: 'p0', n: 90 },
    { code: 'mechanic', playerId: 'p2', n: 1 },
  ]);
  const ids = awards.map((a) => a.playerId);
  expect(new Set(ids).size).toBe(ids.length);
});

it('needs at least one discovery, rescue or repair for those awards', () => {
  const { sim } = crew();
  expect(buildAwards(sim, null)).toEqual([]);
});

it('iron lungs needs a minute outside and goes to the lowest O2 per minute', () => {
  const { sim, c } = crew(2);
  c[0]!.secondsOutside = AWARDS.ironLungsMinS - 1;
  c[0]!.o2Used = 1;
  c[1]!.secondsOutside = 120;
  c[1]!.o2Used = 100;
  expect(buildAwards(sim, null)).toEqual([{ code: 'iron_lungs', playerId: 'p1', n: 50 }]);
  c[0]!.secondsOutside = 120;
  c[0]!.o2Used = 60;
  expect(buildAwards(sim, null)[0]).toMatchObject({ code: 'iron_lungs', playerId: 'p0' });
});

it('the operator is a seismologist with two good picks, otherwise flight director', () => {
  const { sim } = crew(1);
  expect(buildAwards(sim, 'mc')).toEqual([{ code: 'flight_director', playerId: 'mc' }]);
  sim.hidden.stats.locateGood = AWARDS.seismologistPicks;
  expect(buildAwards(sim, 'mc')).toEqual([{ code: 'seismologist', playerId: 'mc', n: 2 }]);
});

it('a solo player keeps a crew award instead of an operator award', () => {
  const { sim, c } = crew(1);
  c[0]!.science = 10;
  expect(buildAwards(sim, 'p0')).toEqual([{ code: 'rock_hound', playerId: 'p0', n: 10 }]);
});

it('counts deposits, distance and rescues per astronaut', () => {
  const { h } = launched(2);
  const sim = h.room.simulation!;
  h.seconds(1 - sim.pub.t);
  const [a, b] = sim.pub.astronauts;
  const lander = sim.pub.lander;
  a!.x = lander.x;
  a!.y = lander.y;
  a!.carrying = [{ siteId: 's', kind: 'delta', tier: 'surface', value: 12, by: a!.id }];
  h.send(a!.id, { t: 'eva:interact' });
  const stats = (id: string) => sim.hidden.stats.crewStats.find((s) => s.id === id)!;
  expect(stats(a!.id)).toMatchObject({ samples: 1, science: 12 });

  h.send(b!.id, { t: 'eva:move', x: b!.x + 3, y: b!.y, facing: 0, moving: true, running: false });
  expect(stats(b!.id).distance).toBeGreaterThan(0);

  a!.status = 'active';
  a!.o2 = a!.o2Max;
  b!.status = 'down';
  b!.downUntil = sim.pub.t + 30;
  b!.x = a!.x + 5;
  b!.y = a!.y;
  h.send(a!.id, { t: 'eva:interact' });
  expect(stats(a!.id).rescues).toBe(1);
});

it('the room passes the MC player to the report', () => {
  const { h, mc } = launched(2);
  h.send(mc, { t: 'debug', cmd: 'skip_phase' });
  const report = h.room.state.report!;
  expect(report.awards.some((a) => a.playerId === mc && a.code === 'flight_director')).toBe(true);
});
