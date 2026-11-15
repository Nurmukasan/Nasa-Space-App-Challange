import type { CrewClassId, PresetId, ScenarioId } from '../src';
import { makeRoom } from './helpers';

export function taskMission(
  n = 1,
  scenario: ScenarioId = 'signal',
  preset: PresetId = 'science',
  seed = 1234,
  classes: CrewClassId[] = ['engineer', 'scout', 'geologist', 'biologist'],
  enabled = true,
) {
  const h = makeRoom(seed);
  const joins = Array.from({ length: n }, (_, i) => h.room.join({ name: `P${i}` }));
  const ids = joins.map((j) => {
    if (!j.ok) throw Error('join');
    return j.playerId;
  });
  ids.forEach((id, i) => {
    h.send(id, { t: 'lobby:role', role: n === 1 ? 'solo' : i === 0 ? 'mc' : 'eva' });
    h.send(id, { t: 'lobby:class', crewClass: classes[i % classes.length]! });
  });
  const host = ids[0]!;
  h.send(host, { t: 'lobby:scenario', id: scenario });
  h.send(host, { t: 'lobby:tasks', enabled });
  h.send(host, { t: 'lobby:start', quick: false });
  h.send(host, { t: 'design:preset', id: preset });
  h.send(host, { t: 'design:launch' });
  const sim = h.room.simulation!;
  sim.pub.t = 0;
  return { h, sim, ids, host };
}
