import { describe, expect, it } from 'vitest';
import {
  COLS,
  DOORS,
  PROPS,
  ROOMS,
  ROWS,
  SPAWN,
  TILE,
  nearestAction,
  roomAt,
  step,
  walkable,
} from './layout';

/** Flood fill over 4-px steps from the spawn point; returns the set of reachable rooms. */
function reachableRooms(): Set<string> {
  const seen = new Set<string>();
  const rooms = new Set<string>();
  const queue: Array<[number, number]> = [[SPAWN.x, SPAWN.y]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key) || !walkable(x, y)) continue;
    seen.add(key);
    const r = roomAt(x, y);
    if (r) rooms.add(r);
    for (const [dx, dy] of [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ] as const)
      queue.push([x + dx, y + dy]);
  }
  return rooms;
}

describe('lander interior layout', () => {
  it('fits one 480x272 screen and spawns inside the airlock on a free spot', () => {
    expect([COLS * TILE, ROWS * TILE]).toEqual([480, 272]);
    expect(roomAt(SPAWN.x, SPAWN.y)).toBe('airlock');
    expect(walkable(SPAWN.x, SPAWN.y)).toBe(true);
  });

  it('connects every room through the doors', () => {
    expect([...reachableRooms()].sort()).toEqual(ROOMS.map((r) => r.id).sort());
  });

  it('has four inner doors and one outer hatch that is never walked through', () => {
    expect(DOORS.filter((d) => !d.outer)).toHaveLength(4);
    const hatch = DOORS.filter((d) => d.outer);
    expect(hatch).toHaveLength(1);
    expect(walkable(hatch[0]!.x, hatch[0]!.y)).toBe(false);
  });

  it('stops at walls but slides along them', () => {
    const start = { x: 2 * TILE, y: 8 * TILE }; // hall, left end
    expect(step(start.x, start.y, -40, 0)).toEqual(start); // wall
    const slid = step(start.x, start.y, -40, 4);
    expect(slid.x).toBe(start.x);
    expect(slid.y).toBe(start.y + 4);
  });

  it('offers the right action next to each kind of furniture', () => {
    const near = (id: string) => {
      const pr = PROPS.find((p) => p.id === id)!;
      return nearestAction((pr.col + pr.w / 2) * TILE, (pr.row + pr.h) * TILE + 4)?.action;
    };
    expect(near('q_bunk')).toBe('sleep');
    expect(near('q_sofa')).toBe('sleep');
    expect(near('ai_screen')).toBe('talk');
    expect(near('core')).toBe('work');
    expect(near('gh_pots_a')).toBe('tend');
    expect(near('console')).toBe('work');
    expect(near('hatch')).toBe('exit');
    expect(nearestAction(15 * TILE, 8 * TILE)).toBeNull(); // middle of the hall
  });
});
