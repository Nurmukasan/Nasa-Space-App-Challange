import { expect, it } from 'vitest';
import { PRESETS, SITES, deriveParams, sandAt } from '@rs/shared';
import { createSim } from '../../../../shared/src/sim/sim';
import { actionHint, hudBanner } from './hudView';

function fixture() {
  const sim = createSim(deriveParams(PRESETS.balanced, 1, 'training'), ['a']);
  sim.pub.t = 100;
  return { snap: sim.pub, a: sim.pub.astronauts[0]! };
}

it('chooses return before rockfall, flare and storm; rockfall before flare', () => {
  const { snap, a } = fixture();
  a.o2 = 10;
  a.dangerUntil = 110;
  snap.flare = { warnAt: 90, tStart: 95, tEnd: 120 };
  snap.weather.storm = { tStart: 95, tEnd: 130 };
  expect(hudBanner(snap, a, 20)?.key).toBe('eva.return_now');
  a.o2 = 90;
  expect(hudBanner(snap, a, 20)?.key).toBe('eva.danger');
  a.dangerUntil = 0;
  expect(hudBanner(snap, a, 20)?.key).toBe('eva.flare_active');
  snap.flare = null;
  expect(hudBanner(snap, a, 20)?.key).toBe('eva.storm');
});

it('a sheltered crew member sees shelter status instead of outside danger', () => {
  const { snap, a } = fixture();
  a.status = 'inside';
  a.o2 = 1;
  a.dangerUntil = 110;
  expect(hudBanner(snap, a, 20)?.key).toBe('eva.inside');
  expect(actionHint(snap, a).key).toBe('eva.exit');
});

it('airlock interaction takes priority over deployment and explains nearby station refusal', () => {
  const { snap, a } = fixture();
  a.kits = 1;
  expect(actionHint(snap, a).key).toBe('eva.airlock');
  a.x = 1000;
  a.y = 1000;
  snap.sites = [];
  snap.stations.push({ x: 1005, y: 1005 });
  expect(actionHint(snap, a).key).toBe('eva.deploy_station');
  snap.stations.pop();
  for (let x = 1000; x < 1400; x += 8) {
    if (!sandAt(x, 1000, SITES.jezero.terrainSalt)) {
      a.x = x;
      break;
    }
  }
  expect(actionHint(snap, a).key).toBe('eva.deploy');
});
