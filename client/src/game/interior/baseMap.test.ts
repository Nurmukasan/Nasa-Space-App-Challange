import { describe, expect, it } from 'vitest';
import {
  ATLAS,
  DOORS,
  PROPS,
  ROOMS,
  SPAWN,
  nearestAction,
  roomAt,
  step,
  walkable,
} from './baseMap';

/** Flood fill over 4-px steps from the spawn point: every feet position the player can reach. */
function reachable(): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  const queue: Array<[number, number]> = [[SPAWN.x, SPAWN.y]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key) || !walkable(x, y)) continue;
    seen.add(key);
    out.push([x, y]);
    queue.push([x + 4, y], [x - 4, y], [x, y + 4], [x, y - 4]);
  }
  return out;
}
const reached = reachable();

describe('lander interior map (base.tmj)', () => {
  it('uses only sprites that exist in the atlas', () => {
    for (const p of PROPS) expect(ATLAS[p.sprite], p.sprite).toBeDefined();
    expect(ATLAS.wall_door).toBeDefined();
  });

  it('spawns on open floor in the hall', () => {
    expect(walkable(SPAWN.x, SPAWN.y)).toBe(true);
    expect(roomAt(SPAWN.x, SPAWN.y)).toBe('hall');
  });

  it('reaches all five compartments and the hall from the spawn point', () => {
    const rooms = new Set(reached.map(([x, y]) => roomAt(x, y)));
    for (const id of ['bridge', 'lab', 'quarters', 'engine', 'greenhouse', 'hall'])
      expect(rooms.has(id), id).toBe(true);
    expect(ROOMS).toHaveLength(6);
  });

  it('walks through every door', () => {
    for (const d of DOORS) {
      const through = reached.some(
        ([x, y]) => x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h,
      );
      expect(through, d.id).toBe(true);
    }
  });

  it('can use every interactive prop', () => {
    for (const p of PROPS.filter((q) => q.action)) {
      const usable = reached.some(([x, y]) => nearestAction(x, y)?.id === p.id);
      expect(usable, p.id).toBe(true);
    }
  });

  it('never lets the astronaut stand on a back wall or its decor', () => {
    // Feet may come close to a poster's bottom edge (the wall meets the floor) but not into it.
    const SLACK = 12;
    for (const p of PROPS.filter((q) => q.wall)) {
      const onIt = reached.find(
        ([x, y]) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h - SLACK,
      );
      expect(onIt, `${p.id} at ${onIt}`).toBeUndefined();
    }
  });

  it('stops at walls and slides along them', () => {
    expect(step(SPAWN.x, SPAWN.y, 0, -400)).toEqual(SPAWN);
    expect(step(SPAWN.x, SPAWN.y, 4, 0).x).toBe(SPAWN.x + 4);
  });
});
