// Furniture of the lander interior, one small painter per kind (see layout.ts PROPS).
import { TILE } from './layout';
import type { Prop } from './layout';
import { P, block, box, monitor, plant, tank } from './paint';
import { drawLiving } from './furnitureLiving';

type Ctx = CanvasRenderingContext2D;

function worldMap(g: Ctx, x: number, y: number, w: number): void {
  // Wall screen with a map of Earth (the mission talks to home).
  box(g, x, y + 1, w, 13, P.rim);
  box(g, x + 1, y + 2, w - 2, 11, '#1f4f8a');
  const land = '#4fae4a';
  [
    [3, 2, 6, 3],
    [5, 5, 3, 4],
    [14, 2, 9, 3],
    [17, 5, 4, 3],
    [24, 3, 10, 4],
    [31, 7, 5, 3],
    [40, 3, 4, 2],
  ].forEach(([dx, dy, ww, hh]) => box(g, x + dx!, y + 2 + dy!, ww!, hh!, land));
  box(g, x + 2, y + 2, w - 4, 1, '#3a6fb0');
}

function lab(g: Ctx, pr: Prop, x: number, y: number, w: number, h: number): boolean {
  switch (pr.kind) {
    case 'worldmap':
      worldMap(g, x, y, w);
      return true;
    case 'toolrack':
      // Wrench, screwdriver and pliers on a pegboard.
      box(g, x + 2, y + 2, w - 4, 12, P.metalDark);
      for (let i = 0; i < 6; i++) box(g, x + 4 + i * 5, y + 4, 1, 1, P.metalDeep);
      box(g, x + 6, y + 4, 2, 9, P.metalHi);
      box(g, x + 5, y + 4, 4, 2, P.metalHi);
      box(g, x + 14, y + 4, 1, 6, P.metalHi);
      box(g, x + 13, y + 9, 3, 4, P.red);
      box(g, x + 21, y + 4, 2, 9, P.metalHi);
      box(g, x + 24, y + 4, 2, 9, P.metalHi);
      return true;
    case 'cabinet':
      block(g, x, y - 6, w, h + 6, P.metal, P.metalHi);
      monitor(g, x + 3, y - 2, 10, 8, '#5ac850');
      box(g, x + 3, y + 10, 10, 1, P.metalDark);
      box(g, x + 3, y + 20, 10, 1, P.metalDark);
      return true;
    case 'computers':
      block(g, x, y + 5, w, h - 5, P.metal, P.metalHi);
      monitor(g, x + 2, y - 4, 13, 11);
      monitor(g, x + 18, y - 3, 12, 10);
      box(g, x + 33, y - 2, 12, 9, P.metalHi); // printer
      box(g, x + 35, y, 8, 2, P.rim);
      box(g, x + 4, y + 8, 10, 2, P.metalDark); // keyboard
      return true;
    case 'locker':
      block(g, x + 1, y - 4, w - 2, h + 4, P.metalDark, P.metal);
      box(g, x + 5, y + 2, 6, 4, '#3a8a4a');
      return true;
    case 'crates':
      for (let i = 0; i < pr.h; i++) {
        const cy = y + i * TILE;
        block(g, x, cy, w, TILE, P.wood, '#b8844c', P.woodDark);
        const load = [P.rock, P.soil, P.rockHi][i % 3]!;
        box(g, x + 3, cy + 3, w - 6, 5, load);
        box(g, x + 5, cy + 2, 4, 2, i === 1 ? P.rock : P.rockHi);
      }
      return true;
    case 'rocktable':
      block(g, x, y + 4, w, h - 4, P.metal, P.metalHi);
      [P.leaf, P.rock, '#a84a2e', '#c6643a', P.rockHi].forEach((c, i) =>
        box(g, x + 3 + i * 6, y + 2 + (i % 2), 5, 4, c),
      );
      return true;
    case 'jars':
      block(g, x, y + 4, w, h - 4, P.metal, P.metalHi);
      for (let i = 0; i < 2; i++) {
        const jx = x + 3 + i * 15;
        box(g, jx, y - 4, 11, 12, P.rim);
        box(g, jx + 1, y - 3, 9, 10, '#a8d8e8');
        box(g, jx + 3, y + 1, 5, 4, i ? '#5ab05a' : '#d05a5a');
        box(g, jx + 1, y - 3, 9, 2, P.metalHi);
      }
      return true;
    case 'pcdesk':
      block(g, x, y, w, h, P.metal, P.metalHi);
      monitor(g, x + 2, y + 2, 12, 10);
      box(g, x + 4, y + 16, 8, 10, P.metalDark); // tower
      return true;
    case 'tank':
      tank(g, x, y - 8, w, h + 8, P.green, P.greenHi);
      return true;
    case 'vent':
      box(g, x + 2, y + 1, w - 4, h - 2, P.rim);
      for (let i = 0; i < 6; i++) box(g, x + 4, y + 3 + i * 2, w - 8, 1, P.metalDark);
      return true;
    case 'pipes':
      box(g, x + 2, y - 4, 4, h + 8, P.red);
      box(g, x + 8, y - 4, 4, h + 8, P.blue);
      box(g, x, y + h - 2, w, 3, P.metalDark);
      return true;
    case 'scopebench':
    case 'soilbench':
      block(g, x, y + 4, w, h - 4, P.sheet, '#ffffff', P.metal);
      if (pr.kind === 'scopebench') {
        box(g, x + 6, y - 6, 3, 10, P.metalDark); // microscope
        box(g, x + 4, y - 7, 7, 2, P.rim);
        box(g, x + 4, y + 2, 7, 2, P.metal);
        box(g, x + 20, y + 1, 6, 4, P.leaf);
        box(g, x + 30, y + 1, 7, 4, P.rockHi);
      } else {
        box(g, x + 4, y - 6, 3, 10, P.metalDark);
        box(g, x + 2, y - 7, 7, 2, P.rim);
        box(g, x + 16, y - 1, 9, 5, P.leafDark);
        box(g, x + 30, y - 2, 12, 6, P.soil);
        box(g, x + 33, y - 3, 6, 2, '#7a5032');
      }
      return true;
  }
  return false;
}

function bridge(g: Ctx, pr: Prop, x: number, y: number, w: number, h: number): boolean {
  switch (pr.kind) {
    case 'screenwall':
      // Six monitors over the console, graphs and maps in teal and orange.
      for (let i = 0; i < 6; i++) {
        monitor(g, x + 1 + i * 16, y + 2, 14, 12, i % 3 === 1 ? '#f0903a' : P.screenGlow);
        if (i === 2 || i === 3) box(g, x + 4 + i * 16, y + 9, 8, 1, '#f0903a');
      }
      return true;
    case 'console':
      block(g, x, y, w, h, P.metalDark, P.metal);
      for (let i = 0; i < w - 8; i += 6) {
        box(
          g,
          x + 4 + i,
          y + 5,
          2,
          2,
          ['#e04a3a', '#3ec44e', '#f2c230', P.screenGlow][(i / 6) % 4]!,
        );
        box(g, x + 4 + i, y + 9, 4, 2, P.screen);
      }
      monitor(g, x + w / 2 - 9, y + 2, 18, 10);
      return true;
    case 'seat':
    case 'captain':
      for (let i = 0; i < pr.w; i += pr.kind === 'captain' ? 2 : 1) {
        const sx = x + i * TILE + (pr.kind === 'captain' ? 8 : 2);
        const body = pr.kind === 'captain' ? '#8a4a2a' : '#4a5468';
        block(g, sx, y + 2, 12, 10, body, pr.kind === 'captain' ? '#b0663a' : '#68748a');
        box(g, sx + 5, y + 12, 2, 3, P.metalDark);
        box(g, sx + 2, y + 14, 8, 2, P.rim);
      }
      return true;
    case 'wallpanel':
      box(g, x + 2, y + 2, w - 4, 9, P.rim);
      box(g, x + 3, y + 3, w - 6, 7, P.screen);
      box(g, x + 5, y + 5, w - 14, 1, '#3ec44e');
      box(g, x + 5, y + 7, w - 10, 1, P.screenGlow);
      return true;
  }
  return false;
}

function greenhouse(g: Ctx, pr: Prop, x: number, y: number, w: number, h: number): boolean {
  switch (pr.kind) {
    case 'growlights':
      box(g, x + 4, y + 5, 40, 3, '#fff6c0');
      box(g, x + w - 44, y + 5, 40, 3, '#fff6c0');
      box(g, x + 4, y + 8, 40, 1, P.metal);
      box(g, x + w - 44, y + 8, 40, 1, P.metal);
      return true;
    case 'planter':
      block(g, x, y + 6, w, h - 6, P.wood, '#b8844c', P.woodDark);
      box(g, x + 2, y + 7, w - 4, 3, P.soil);
      for (let i = 0; i < pr.w * 2; i++)
        plant(
          g,
          x + 5 + i * 7,
          y + 8,
          1 + (i % 3),
          i % 4 === 1 ? P.flower : i % 4 === 3 ? P.violet : undefined,
        );
      return true;
    case 'bed_plants':
      block(g, x, y, w, h, P.wood, '#b8844c', P.woodDark);
      box(g, x + 2, y + 2, w - 4, h - 4, P.soil);
      for (let i = 0; i < pr.h * 2; i++)
        plant(g, x + 8, y + 8 + i * 8, 1 + (i % 2), i % 3 === 2 ? P.bloom : undefined);
      return true;
    case 'tankblue':
      tank(g, x + 1, y - 6, w - 2, h + 6, P.water, P.waterHi);
      box(g, x + 6, y + h - 2, 4, 3, P.metalDark);
      return true;
    case 'tankgreen':
      tank(g, x + 1, y - 6, w - 2, h + 6, P.green, P.greenHi);
      box(g, x + 6, y + h - 2, 4, 3, P.metalDark);
      return true;
    case 'pump':
      box(g, x - 2, y + 2, w + 4, 3, P.blue); // pipe joining the two tanks
      block(g, x + 2, y + 4, 12, 10, P.metalDark, P.metal);
      box(g, x + 5, y + 7, 6, 4, '#3ec44e');
      return true;
    case 'channel':
      box(g, x, y, w, h, P.metalDark);
      box(g, x + 3, y + 1, w - 6, h - 2, '#1f5f9a');
      for (let i = 0; i < h; i += 6) box(g, x + 5, y + 2 + i, w - 12, 1, P.waterHi);
      box(g, x + 1, y, 2, h, P.metal);
      box(g, x + w - 3, y, 2, h, P.metal);
      return true;
  }
  return false;
}

export function drawProp(g: Ctx, pr: Prop): void {
  const x = pr.col * TILE,
    y = pr.row * TILE,
    w = pr.w * TILE,
    h = pr.h * TILE;
  if (pr.kind === 'ai' || pr.kind === 'hatch') return; // animated: drawn by the scene
  if (lab(g, pr, x, y, w, h) || bridge(g, pr, x, y, w, h) || greenhouse(g, pr, x, y, w, h)) return;
  if (drawLiving(g, pr, x, y, w, h)) return;
  block(g, x, y, w, h, P.metal, P.metalHi);
}
