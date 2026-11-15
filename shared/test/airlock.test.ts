// Airlock: an empty O2 store must not trap a crew member outside the hull (balance soak, A12).
// The free mission used to keep the trap as "v1 behaviour"; bots died at the door, so it is fixed.
import { expect, it } from 'vitest';
import { AIRLOCK, PRESETS, deriveParams } from '../src';
import type { ScenarioId } from '../src';
import { createSim } from '../src/sim/sim';
import { handleSimMsg } from '../src/sim/input';

function atDoor(scenario: ScenarioId, store: number) {
  const sim = createSim(deriveParams(PRESETS.balanced, 1, scenario), ['a']);
  sim.pub.t = 10;
  const a = sim.pub.astronauts[0]!;
  a.status = 'active';
  a.x = sim.pub.lander.x;
  a.y = sim.pub.lander.y;
  a.o2 = 30;
  sim.pub.lander.o2Store = store;
  handleSimMsg(sim, 'a', true, false, { t: 'eva:interact' });
  return a;
}

for (const scenario of ['signal', 'training', 'free'] as const)
  it(`${scenario}: E at the airlock enters with a part-full suit when the store is empty`, () => {
    expect(atDoor(scenario, 0).status).toBe('inside');
    expect(atDoor(scenario, AIRLOCK.emptyStore - 0.5).status).toBe('inside');
  });

it('with oxygen in the store, E still asks for a refill first', () => {
  const a = atDoor('signal', 100);
  expect(a.status).toBe('active');
  expect(a.wantsRefill).toBe(true);
});

it('free mission: with oxygen in the store, E still asks for a refill first', () => {
  const a = atDoor('free', 100);
  expect(a.status).toBe('active');
  expect(a.wantsRefill).toBe(true);
});
