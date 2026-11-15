// ARIA's face, drawn into the screen of the lab terminal (atlas sprite ai_monitor).
// Same look as the tileset (teal smile on dark teal) so the still frame matches the art.
import type { Look } from './assistant';

/** Face canvas size; the scene scales it onto the monitor's screen (AI_SCREEN). */
export const FACE_W = 25;
export const FACE_H = 17;
/** The screen inside the ai_monitor sprite (sprite px). */
export const AI_SCREEN = { dx: 10, dy: 12, w: 97, h: 78 };

const BG = { neutral: '#163435', happy: '#163a30', worried: '#33300f', alarm: '#5a0c10' };
const INK = { neutral: '#80ffff', happy: '#9affc0', worried: '#ffd860', alarm: '#ffd0c0' };

type Ctx = CanvasRenderingContext2D;
const box = (g: Ctx, x: number, y: number, w: number, h: number, c: string): void => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Draws the face for `look`; `flash` blinks the alarm background. */
export function drawFace(g: Ctx, look: Look, flash: boolean): void {
  const mood = look.mood;
  box(g, 0, 0, FACE_W, FACE_H, mood === 'alarm' && flash ? '#a01818' : BG[mood]);
  for (let y = 1; y < FACE_H; y += 3) box(g, 0, y, FACE_W, 1, 'rgba(0,0,0,0.16)');
  const ink = INK[mood];
  const cx = Math.floor(FACE_W / 2);
  if (look.alarm && look.text === null) {
    // Silent alarm: a warning triangle instead of the face.
    for (let r = 0; r < 12; r++) box(g, cx - r * 0.6, 2 + r, r * 1.2 + 1, 1, '#ffd040');
    box(g, cx, 6, 1, 4, '#5a0c10');
    box(g, cx, 11, 1, 1, '#5a0c10');
    return;
  }
  // Eyes: 3x4 blocks like the picture; lines when blinking, arcs when happy.
  const ey = 3,
    lx = cx - 6,
    rx = cx + 4;
  if (look.eyesClosed) {
    box(g, lx, ey + 2, 3, 1, ink);
    box(g, rx, ey + 2, 3, 1, ink);
  } else if (mood === 'happy') {
    for (const ex of [lx, rx]) {
      box(g, ex, ey + 2, 1, 1, ink);
      box(g, ex + 1, ey + 1, 1, 1, ink);
      box(g, ex + 2, ey + 2, 1, 1, ink);
    }
  } else {
    box(g, lx, ey, 3, 4, ink);
    box(g, rx, ey, 3, 4, ink);
  }
  if (mood === 'worried' || mood === 'alarm') {
    box(g, lx, ey - 2, 2, 1, ink);
    box(g, lx + 2, ey - 1, 1, 1, ink);
    box(g, rx, ey - 1, 1, 1, ink);
    box(g, rx + 1, ey - 2, 2, 1, ink);
  }
  // Mouth: the picture's smile when idle; half open and open while talking.
  const my = 10;
  if (look.mouth === 0) {
    if (mood === 'worried' || mood === 'alarm') {
      box(g, cx - 3, my + 1, 7, 1, ink);
      box(g, cx - 4, my + 2, 1, 1, ink);
      box(g, cx + 4, my + 2, 1, 1, ink);
    } else {
      box(g, cx - 5, my, 1, 1, ink);
      box(g, cx - 4, my + 1, 9, 1, ink);
      box(g, cx + 5, my, 1, 1, ink);
    }
  } else {
    const h = look.mouth === 1 ? 1 : 3;
    box(g, cx - 3, my, 7, h + 2, ink);
    box(g, cx - 2, my + 1, 5, h, '#06161a');
  }
}
