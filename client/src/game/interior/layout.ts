// Inside the lander: one screen (30 x 17 tiles of 16 px), drawn without scrolling.
// Pure data and geometry, no Phaser: the scene, the art and the tests all read this file.

export const TILE = 16;
export const COLS = 30;
export const ROWS = 17;

/**
 * Floor plan after the team's reference picture: the bridge juts out at the top, the hall in the
 * middle opens to the lab (left) and the greenhouse (right); quarters, engine room and airlock below.
 * '#' wall, '.' floor, 'D' sliding door (2 tiles wide), ' ' outside the hull (the surface shows through).
 */
const MAP = [
  '           ########           ',
  '           #......#           ',
  '############......############',
  '#.........##......##.........#',
  '#.........####DD####.........#',
  '#.........#........#.........#',
  '#............................#',
  '#............................#',
  '#.........#........#.........#',
  '#.........####DD####.........#',
  '#.........##......##.........#',
  '####DD######......#####DD#####',
  '#.........##......##.........#',
  '#.........##......##.........#',
  '#.........##......##.........#',
  '#.........##......##.........#',
  '##########################DD##',
];

export type RoomId = 'lab' | 'bridge' | 'greenhouse' | 'quarters' | 'engine' | 'airlock' | 'hall';
export const ROOMS: Array<{ id: RoomId; col: number; row: number; w: number; h: number }> = [
  { id: 'bridge', col: 12, row: 1, w: 6, h: 3 },
  { id: 'lab', col: 1, row: 3, w: 9, h: 8 },
  { id: 'hall', col: 10, row: 5, w: 10, h: 4 },
  { id: 'greenhouse', col: 20, row: 3, w: 9, h: 8 },
  { id: 'quarters', col: 1, row: 12, w: 9, h: 4 },
  { id: 'engine', col: 12, row: 10, w: 6, h: 6 },
  { id: 'airlock', col: 20, row: 12, w: 9, h: 4 },
];

export type ActionKind = 'sleep' | 'work' | 'tend' | 'talk' | 'exit';

/** Furniture in tile units. Solid pieces block walking; `action` pieces answer the E key. */
export interface Prop {
  id: string;
  kind: string;
  col: number;
  row: number;
  w: number;
  h: number;
  solid: boolean;
  action?: ActionKind;
}

const p = (
  id: string,
  kind: string,
  col: number,
  row: number,
  w: number,
  h: number,
  action?: ActionKind,
  solid = true,
): Prop => ({ id, kind, col, row, w, h, solid, action });

export const PROPS: Prop[] = [
  // Lab: wall map, computers, the ARIA monitor, tool rack, rock crates, sample tables,
  // two culture tanks with a floor vent, and microscope benches along the south wall.
  p('lab_map', 'worldmap', 2, 2, 3, 1, undefined, false),
  p('lab_cabinet', 'cabinet', 1, 3, 1, 2),
  p('lab_desk', 'computers', 2, 3, 3, 1, 'work'),
  p('ai_screen', 'ai', 5, 3, 2, 1, 'talk'),
  p('lab_rack', 'toolrack', 7, 2, 2, 1, undefined, false),
  p('lab_locker', 'locker', 7, 3, 1, 1),
  p('lab_crates', 'crates', 9, 3, 1, 3),
  p('lab_rocks', 'rocktable', 4, 5, 2, 1, 'work'),
  p('lab_jars', 'jars', 6, 5, 2, 1, 'work'),
  p('lab_pc', 'pcdesk', 1, 6, 1, 2, 'work'),
  p('lab_tank_a', 'tank', 3, 7, 1, 2),
  p('lab_vent', 'vent', 4, 8, 2, 1, undefined, false),
  p('lab_tank_b', 'tank', 6, 7, 1, 2),
  p('lab_pipes', 'pipes', 8, 7, 1, 1),
  p('lab_scope', 'scopebench', 1, 10, 3, 1, 'work'),
  p('lab_soil', 'soilbench', 6, 10, 3, 1, 'work'),
  // Bridge: a wall of monitors over the long console, three seats.
  p('bridge_screens', 'screenwall', 12, 0, 6, 1, undefined, false),
  p('console', 'console', 12, 1, 6, 1, 'work'),
  p('seat_l', 'seat', 12, 2, 1, 1, undefined, false),
  p('seat_c', 'captain', 14, 2, 2, 1, undefined, false),
  p('seat_r', 'seat', 17, 2, 1, 1, undefined, false),
  // Hall: status panels on the north wall either side of the bridge door.
  p('hall_panel_l', 'wallpanel', 11, 4, 2, 1, undefined, false),
  p('hall_panel_r', 'wallpanel', 17, 4, 2, 1, undefined, false),
  // Greenhouse: grow lights, planters, blue and green tanks on pipes, a water channel, beds.
  p('gh_lights', 'growlights', 20, 2, 9, 1, undefined, false),
  p('gh_planter_a', 'planter', 20, 3, 3, 1, 'tend'),
  p('gh_tank_blue', 'tankblue', 23, 3, 1, 1),
  p('gh_pump', 'pump', 24, 3, 1, 1),
  p('gh_tank_green', 'tankgreen', 25, 3, 1, 1),
  p('gh_planter_b', 'planter', 26, 3, 3, 1, 'tend'),
  p('gh_tank_side', 'tankblue', 20, 8, 1, 2),
  p('gh_channel', 'channel', 23, 6, 2, 4),
  p('gh_bed_a', 'bed_plants', 21, 6, 1, 4, 'tend'),
  p('gh_bed_b', 'bed_plants', 26, 6, 1, 4, 'tend'),
  p('gh_pots_a', 'planter', 27, 6, 2, 1, 'tend'),
  p('gh_pots_b', 'planter', 27, 9, 2, 1, 'tend'),
  // Quarters: kitchen, posters, sofa and bunk, coffee table, arcade cabinet, a potted plant.
  p('q_stove', 'stove', 1, 12, 1, 1),
  p('q_sink', 'sink', 2, 12, 1, 1),
  p('q_fridge', 'fridge', 3, 12, 1, 1),
  p('q_posters', 'posters', 6, 11, 3, 1, undefined, false),
  p('q_arcade', 'arcade', 9, 12, 1, 1, 'work'),
  p('q_bunk', 'bunk', 1, 14, 2, 1, 'sleep'),
  p('q_sofa', 'sofa', 5, 14, 3, 1, 'sleep'),
  p('q_table', 'coffeetable', 5, 15, 3, 1, undefined, false),
  p('q_plant', 'pot', 9, 15, 1, 1),
  // Engine room: lockers and tool board, the reactor core, control panel, pipes.
  p('e_lockers', 'lockers', 12, 10, 1, 2),
  p('e_toolboard', 'toolboard', 12, 13, 1, 1, 'work'),
  p('core', 'core', 14, 12, 2, 2, 'work'),
  p('e_panel', 'enginepanel', 16, 10, 2, 1, 'work'),
  p('e_pipes', 'pipes', 17, 12, 1, 3),
  // Airlock: suit rack, bench and the outer hatch (doorway in the south wall).
  p('suits', 'suits', 20, 12, 3, 1),
  p('al_bench', 'bench', 26, 12, 2, 1),
  p('hatch', 'hatch', 26, 15, 2, 1, 'exit', false),
];

/** Where the astronaut appears after cycling the airlock (pixel coordinates, feet). */
export const SPAWN = { x: 27 * TILE, y: 14 * TILE };
/** Feet hit-box half sizes, px. */
const FOOT_W = 4;
const FOOT_H = 3;
/** How far (px) from a prop's edge the E key still reaches it. */
export const REACH = 10;
/** Doors open when an astronaut's feet are this close (px) to the door centre. */
export const DOOR_RANGE = 30;

export interface Door {
  col: number;
  row: number;
  /** Pixel centre of the 2-tile doorway. */
  x: number;
  y: number;
  /** The hatch to the surface stays shut until the astronaut uses it. */
  outer: boolean;
}

export const DOORS: Door[] = [];
MAP.forEach((line, row) => {
  for (let col = 0; col < COLS; col++)
    if (line[col] === 'D' && line[col - 1] !== 'D')
      DOORS.push({
        col,
        row,
        x: (col + 1) * TILE,
        y: row * TILE + TILE / 2,
        outer: row === ROWS - 1,
      });
});

export function cellAt(col: number, row: number): string {
  return MAP[row]?.[col] ?? '#';
}

function solidAt(x: number, y: number): boolean {
  const col = Math.floor(x / TILE),
    row = Math.floor(y / TILE);
  const c = cellAt(col, row);
  if (c === '#' || c === ' ') return true;
  if (c === 'D') return row === ROWS - 1; // the outer hatch is never walked through
  return PROPS.some(
    (pr) =>
      pr.solid && col >= pr.col && col < pr.col + pr.w && row >= pr.row && row < pr.row + pr.h,
  );
}

/** True if feet at (x, y) do not overlap a wall or solid furniture. */
export function walkable(x: number, y: number): boolean {
  return (
    !solidAt(x - FOOT_W, y - FOOT_H) &&
    !solidAt(x + FOOT_W, y - FOOT_H) &&
    !solidAt(x - FOOT_W, y + FOOT_H) &&
    !solidAt(x + FOOT_W, y + FOOT_H)
  );
}

/** Move with wall sliding: try both axes, then each axis alone. */
export function step(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  if (walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  if (dx !== 0 && walkable(x + dx, y)) return { x: x + dx, y };
  if (dy !== 0 && walkable(x, y + dy)) return { x, y: y + dy };
  return { x, y };
}

/** The usable prop closest to the feet, within REACH of its edge. */
export function nearestAction(x: number, y: number): Prop | null {
  let best: Prop | null = null,
    bestD = Infinity;
  for (const pr of PROPS) {
    if (!pr.action) continue;
    const left = pr.col * TILE,
      top = pr.row * TILE;
    const dx = Math.max(left - x, 0, x - (left + pr.w * TILE));
    const dy = Math.max(top - y, 0, y - (top + pr.h * TILE));
    const d = Math.hypot(dx, dy);
    if (d <= REACH && d < bestD) {
      best = pr;
      bestD = d;
    }
  }
  return best;
}

export function roomAt(x: number, y: number): RoomId | null {
  const col = Math.floor(x / TILE),
    row = Math.floor(y / TILE);
  return (
    ROOMS.find((r) => col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h)?.id ??
    null
  );
}
