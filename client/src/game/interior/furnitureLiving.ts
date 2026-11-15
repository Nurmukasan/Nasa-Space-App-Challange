// Quarters, engine room and airlock furniture (split from furniture.ts to keep files small).
import type { Prop } from './layout';
import { P, block, box, monitor, plant } from './paint';

type Ctx = CanvasRenderingContext2D;

export function drawLiving(g: Ctx, pr: Prop, x: number, y: number, w: number, h: number): boolean {
  switch (pr.kind) {
    // ---- quarters ----
    case 'stove':
      block(g, x, y - 2, w, h + 2, P.metalHi, '#ffffff', P.metal);
      box(g, x + 3, y + 1, 4, 4, P.rim);
      box(g, x + 9, y + 1, 4, 4, P.rim);
      box(g, x + 3, y + 8, 10, 4, P.metalDark);
      return true;
    case 'sink':
      block(g, x, y - 2, w, h + 2, P.metalHi, '#ffffff', P.metal);
      box(g, x + 3, y + 2, 10, 5, P.metalDark);
      box(g, x + 7, y - 4, 2, 5, P.metal);
      return true;
    case 'fridge':
      block(g, x, y - 10, w, h + 10, '#d8dde6', '#ffffff', P.metal);
      box(g, x + 2, y - 2, w - 4, 1, P.metal);
      box(g, x + 12, y - 7, 1, 4, P.metalDark);
      return true;
    case 'posters':
      [
        ['#e8d8b0', P.red],
        ['#2a4a8a', '#e2ecff'],
        ['#4a2a6a', '#9ad860'],
      ].forEach(([paper, ink], i) => {
        box(g, x + 2 + i * 16, y + 1, 12, 13, P.rim);
        box(g, x + 3 + i * 16, y + 2, 10, 11, paper!);
        box(g, x + 5 + i * 16, y + 4, 6, 5, ink!);
      });
      return true;
    case 'arcade':
      block(g, x, y - 10, w, h + 10, '#3a2a6a', '#6a4ab0');
      monitor(g, x + 2, y - 7, 12, 9, '#9ad860');
      box(g, x + 4, y + 5, 2, 2, P.red);
      box(g, x + 9, y + 5, 3, 2, P.stripe);
      return true;
    case 'bunk':
      block(g, x, y - 2, w, h + 2, P.metalDark, P.metal);
      box(g, x + 2, y, w - 4, h - 4, '#2e5a8a');
      box(g, x + w - 10, y, 8, h - 4, P.sheet); // pillow
      return true;
    case 'sofa':
      block(g, x, y - 4, w, h + 4, P.cloth, P.clothHi, '#8a4a24');
      box(g, x + 2, y + 2, w - 4, 6, P.clothHi);
      box(g, x + 15, y + 2, 1, 6, P.cloth);
      box(g, x + 31, y + 2, 1, 6, P.cloth);
      return true;
    case 'coffeetable':
      block(g, x + 6, y + 2, w - 12, h - 6, P.wood, '#b8844c', P.woodDark);
      box(g, x + 14, y + 4, 6, 3, P.sheet);
      return true;
    case 'pot':
      block(g, x + 3, y + 7, 10, 8, '#a8583a', '#c87050');
      plant(g, x + 8, y + 8, 3);
      return true;
    // ---- engine room ----
    case 'lockers':
      for (let i = 0; i < pr.h; i++) {
        block(g, x, y + i * 16 - 2, w, 16, P.wood, '#b8844c', P.woodDark);
        box(g, x + 3, y + i * 16 + 3, w - 6, 3, P.woodDark);
      }
      return true;
    case 'toolboard':
      block(g, x, y - 4, w, h + 4, P.metalDark, P.metal);
      box(g, x + 4, y - 1, 2, 9, P.metalHi);
      box(g, x + 9, y, 3, 3, P.metalHi);
      box(g, x + 9, y + 4, 2, 5, P.red);
      return true;
    case 'enginepanel':
      block(g, x, y, w, h, P.metalDark, P.metal);
      monitor(g, x + 3, y + 2, 26, 10);
      return true;
    case 'core':
      // Base ring and housing; the glowing column is animated by the scene.
      box(g, x - 6, y + h - 6, w + 12, 8, P.rim);
      box(g, x - 5, y + h - 5, w + 10, 6, P.metalDark);
      block(g, x - 2, y - 12, w + 4, h + 10, P.metal, P.metalHi);
      box(g, x + 4, y - 8, w - 8, h + 2, P.rim);
      box(g, x - 10, y + 4, 8, 4, P.blue); // feed pipes
      box(g, x + w + 2, y + 6, 10, 4, P.metal);
      return true;
    // ---- airlock ----
    case 'suits':
      for (let i = 0; i < pr.w; i++) {
        const sx = x + i * 16;
        block(g, sx + 2, y - 4, 12, 18, P.sheet, '#ffffff', '#b8bcc6');
        box(g, sx + 4, y - 2, 8, 5, '#c4b99e');
        box(g, sx + 4, y + 7, 8, 1, P.stripe);
      }
      return true;
    case 'bench':
      block(g, x, y + 4, w, h - 6, P.metal, P.metalHi);
      return true;
  }
  return false;
}
