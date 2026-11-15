import { describe, expect, it } from 'vitest';
import {
  DOORS,
  DOOR_H,
  DOOR_W,
  IMG_H,
  IMG_W,
  ROOMS,
  SPAWN,
  SPOTS,
  nearestAction,
  roomAt,
  step,
  walkable,
} from './layout';
import { WALK, WALK_CELL } from './walkMask';

/** Flood fill over 2-px steps from the spawn point; returns the walkable points reached. */
function reachable(): Set<string> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[SPAWN.x, SPAWN.y]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key) || !walkable(x, y)) continue;
    seen.add(key);
    for (const [dx, dy] of [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ] as const)
      queue.push([x + dx, y + dy]);
  }
  return seen;
}
const reached = reachable();
const rooms = new Set(
  [...reached].map((k) => roomAt(...(k.split(',').map(Number) as [number, number]))),
);

describe('lander interior (reference picture)', () => {
  it('walk mask covers the whole picture', () => {
    expect(WALK).toHaveLength(Math.floor(IMG_H / WALK_CELL));
    for (const row of WALK) expect(row).toHaveLength(IMG_W / WALK_CELL);
  });

  it('spawns on floor in the hall', () => {
    expect(walkable(SPAWN.x, SPAWN.y)).toBe(true);
    expect(roomAt(SPAWN.x, SPAWN.y)).toBe('hall');
  });

  it('every room can be walked into from the spawn point', () => {
    for (const room of ROOMS) expect(rooms.has(room.id), room.id).toBe(true);
  });

  it('every spot can be reached and used', () => {
    for (const spot of SPOTS) {
      const usable = [...reached].some((k) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return nearestAction(x, y)?.id === spot.id;
      });
      expect(usable, spot.id).toBe(true);
    }
  });

  it('doors stand in walkable doorways', () => {
    for (const d of DOORS) expect(walkable(d.x + DOOR_W / 2, d.y + DOOR_H / 2), d.id).toBe(true);
  });

  it('stops at walls but slides along them', () => {
    const blocked = step(SPAWN.x, SPAWN.y, 0, -200);
    expect(blocked).toEqual({ x: SPAWN.x, y: SPAWN.y });
    expect(step(SPAWN.x, SPAWN.y, 2, 0).x).toBe(SPAWN.x + 2);
  });

  it('offers the right action next to key pieces of furniture', () => {
    const at = (id: string) => SPOTS.find((s) => s.id === id)!.action;
    expect(at('aria')).toBe('talk');
    expect(at('sofa')).toBe('sleep');
    expect(at('core')).toBe('work');
    expect(at('gh_beds')).toBe('tend');
    expect(at('airlock')).toBe('exit');
    expect(nearestAction(240, 140)).toBeNull(); // middle of the hall
  });
});
