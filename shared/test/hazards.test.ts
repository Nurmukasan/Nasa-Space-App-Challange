import { expect, it } from 'vitest';
import { O2, PRESETS, deriveParams, nearLedge } from '../src';
import type { EventKind } from '../src';
import { createSim } from '../src/sim/sim';
import { seismicSystem } from '../src/sim/seismic';
import { hazardSystem } from '../src/sim/hazards';
import { handleSimMsg } from '../src/sim/input';

function setup(kind: EventKind = 'quake') {
  const sim = createSim(deriveParams(PRESETS.balanced, 1), ['a', 'b']);
  sim.hidden.schedule = [{ id: 'event', kind, x: 700, y: 500, t0: 10, fired: false }];
  sim.pub.t = 10;
  seismicSystem(sim, 0);
  return sim;
}
for (const truth of ['quake', 'impact', 'wind'] as const)
  for (const guess of ['quake', 'impact', 'wind', null] as const) {
    it(`resolves ${truth} / ${guess} with the correct statistics and visibility`, () => {
      const sim = setup(truth);
      if (guess)
        handleSimMsg(sim, 'mc', false, true, { t: 'mc:classify', eventId: 'event', kind: guess });
      else {
        sim.pub.t = 18;
        seismicSystem(sim, 0);
      }
      const e = sim.pub.seismic[0]!;
      expect(e.truth).toBe(truth);
      expect(e.guess).toBe(guess);
      expect(sim.hidden.stats.classifyCorrect).toBe(guess === truth ? 1 : 0);
      expect(sim.hidden.stats.classifyMissed).toBe(guess === null ? 1 : 0);
      expect(sim.hidden.stats.classifyWrong).toBe(guess && guess !== truth ? 1 : 0);
      expect(sim.hidden.stats.falseAlarms).toBe(truth === 'wind' && guess === 'quake' ? 1 : 0);
      if (truth === 'quake') expect(sim.pub.hazards.length).toBe(guess === truth ? 1 : 0);
      if (truth === 'impact')
        expect(sim.pub.sites.find((s) => s.kind === 'impact')?.known).toBe(guess === truth);
    });
  }
it('ignores unauthorized, duplicate, malformed and late classifications', () => {
  const sim = setup();
  handleSimMsg(sim, 'a', true, false, { t: 'mc:classify', eventId: 'event', kind: 'quake' });
  expect(sim.pub.seismic[0]!.truth).toBeNull();
  sim.pub.t = 18;
  handleSimMsg(sim, 'mc', false, true, { t: 'mc:classify', eventId: 'event', kind: 'quake' });
  expect(sim.hidden.stats.classifyCorrect).toBe(0);
  seismicSystem(sim, 0);
  expect(sim.hidden.stats.classifyMissed).toBe(1);
});
it('warns only linked astronauts in the quake zone', () => {
  const sim = setup();
  const [a, b] = sim.pub.astronauts;
  Object.assign(a!, { x: 700, y: 500, linked: true });
  Object.assign(b!, { x: 700, y: 500, linked: false });
  handleSimMsg(sim, 'mc', false, true, { t: 'mc:classify', eventId: 'event', kind: 'quake' });
  expect(a!.dangerUntil).toBe(20);
  expect(b!.dangerUntil).toBe(0);
  expect(sim.pub.seismic[0]!.estimate!.r).toBe(40);
});
it('keeps unclassified rockfall private until hit; requires both radius and ledge; hits once', () => {
  const sim = setup();
  expect(sim.pub.hazards).toHaveLength(0);
  const a = sim.pub.astronauts[0]!;
  const b = sim.pub.astronauts[1]!;
  Object.assign(sim.hidden.pendingRockfalls[0]!, { x: 24, y: 1382 });
  let edge = { x: 0, y: 0 },
    flat = { x: 0, y: 0 };
  for (let x = 8; x <= 174; x += 2)
    for (let y = 1232; y <= 1528; y += 2) {
      if (Math.hypot(x - 24, y - 1382) > 150) continue;
      if (nearLedge(x, y, sim.salt, 28)) edge = { x, y };
      else flat = { x, y };
    }
  expect(flat.x).toBeGreaterThan(0);
  Object.assign(a, edge);
  Object.assign(b, flat);
  const before = a.o2;
  sim.pub.t = 19;
  hazardSystem(sim, 0);
  expect(a.leak).toBe(true);
  expect(a.o2).toBe(before - O2.breachLoss);
  expect(b.leak).toBe(false);
  expect(sim.pub.hazards).toHaveLength(1);
  hazardSystem(sim, 0);
  expect(sim.hidden.stats.breaches).toBe(1);
  sim.pub.t = 21;
  hazardSystem(sim, 0);
  expect(sim.pub.hazards).toHaveLength(0);
});
it('impact ice disappears 150 seconds after impact', () => {
  const sim = setup('impact');
  expect(sim.pub.sites.some((s) => s.kind === 'impact')).toBe(true);
  sim.pub.t = 160;
  hazardSystem(sim, 0);
  expect(sim.pub.sites.some((s) => s.kind === 'impact')).toBe(false);
});

it('rejects malformed replies and counts valid duplicate replies only once', () => {
  const sim = setup();
  for (const msg of [
    { t: 'mc:classify' },
    { t: 'mc:classify', eventId: {}, kind: 'quake' },
    { t: 'mc:classify', eventId: 'event', kind: '__proto__' },
  ]) {
    handleSimMsg(sim, 'mc', false, true, msg as never);
    expect(sim.pub.seismic[0]!.truth).toBeNull();
  }
  for (let i = 0; i < 3; i++)
    handleSimMsg(sim, 'mc', false, true, { t: 'mc:classify', eventId: 'event', kind: 'quake' });
  expect(sim.hidden.stats.classifyCorrect).toBe(1);
  expect(sim.pub.hazards).toHaveLength(1);
});
it('false alarms warn only connected crew, even away from the wind station', () => {
  const sim = setup('wind');
  sim.pub.astronauts[0]!.linked = true;
  sim.pub.astronauts[1]!.linked = false;
  handleSimMsg(sim, 'mc', false, true, { t: 'mc:classify', eventId: 'event', kind: 'quake' });
  expect(sim.pub.astronauts[0]!.dangerUntil).toBe(18);
  expect(sim.pub.astronauts[1]!.dangerUntil).toBe(0);
});
it('astronauts outside the radius or inside the lander are never breached', () => {
  const sim = setup();
  Object.assign(sim.pub.astronauts[0]!, { x: 1200, y: 1200 });
  Object.assign(sim.pub.astronauts[1]!, { x: 700, y: 500, status: 'inside' });
  sim.pub.t = 19;
  hazardSystem(sim, 0);
  expect(sim.hidden.stats.breaches).toBe(0);
});
