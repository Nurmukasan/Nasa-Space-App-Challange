// Animated interior pieces drawn in code: sliding door frames and the AI assistant's face.
import type { Look } from './assistant';

export const DOOR_W = 32;
export const DOOR_H = 16;
export const DOOR_FRAMES = 6;
export const SCREEN_W = 64;
export const SCREEN_H = 32;

type Ctx = CanvasRenderingContext2D;
const box = (g: Ctx, x: number, y: number, w: number, h: number, c: string): void => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Strip of door frames: 0 shut ... DOOR_FRAMES-1 fully open (panels slid into the wall). */
export function doorSheet(outer: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = DOOR_W * DOOR_FRAMES;
  canvas.height = DOOR_H;
  const g = canvas.getContext('2d')!;
  const stripe = outer ? '#d03030' : '#f2c230';
  for (let f = 0; f < DOOR_FRAMES; f++) {
    const ox = f * DOOR_W;
    const slide = Math.round((f / (DOOR_FRAMES - 1)) * 14);
    for (const side of [-1, 1]) {
      // Each panel is half the doorway; it slides away from the centre line.
      const px = side < 0 ? ox - slide : ox + 16 + slide;
      const left = Math.max(ox, px),
        right = Math.min(ox + DOOR_W, px + 16);
      if (right - left <= 0) continue;
      box(g, left, 0, right - left, DOOR_H, '#12141c');
      box(g, left + 1, 1, right - left - 2, DOOR_H - 2, '#8a94a4');
      box(g, left + 1, 1, right - left - 2, 2, '#b4bccb');
      box(g, left + 1, DOOR_H - 4, right - left - 2, 2, stripe);
      // Window slit near the centre edge of each panel.
      const wx = side < 0 ? px + 11 : px + 3;
      if (wx >= left && wx + 2 <= right) box(g, wx, 5, 2, 4, '#2fd6d0');
    }
  }
  return canvas;
}

const BG = { neutral: '#0e2a30', happy: '#0e3028', worried: '#2a2a10', alarm: '#5a0c10' };
const INK = { neutral: '#2fd6d0', happy: '#7cf0a0', worried: '#f2c230', alarm: '#ffd0c0' };

/**
 * Draws the assistant screen (bezel, face, mouth) for `look` into `g` at 0,0.
 * `flash` toggles the alarm background so the warning blinks.
 */
export function drawScreen(g: Ctx, look: Look, flash: boolean): void {
  const mood = look.mood;
  // Bezel and stand.
  box(g, 0, 0, SCREEN_W, SCREEN_H, '#12141c');
  box(g, 1, 1, SCREEN_W - 2, SCREEN_H - 2, '#3a4150');
  box(g, 1, 1, SCREEN_W - 2, 2, '#5a6476');
  const sx = 4,
    sy = 4,
    sw = SCREEN_W - 8,
    sh = SCREEN_H - 9;
  box(g, sx, sy, sw, sh, mood === 'alarm' && flash ? '#a01818' : BG[mood]);
  // Scan lines.
  for (let y = sy + 1; y < sy + sh; y += 3) box(g, sx, y, sw, 1, 'rgba(0,0,0,0.18)');
  box(g, SCREEN_W - 9, SCREEN_H - 4, 2, 2, mood === 'alarm' ? '#ff5040' : '#3ec44e'); // power LED

  const ink = INK[mood];
  if (look.alarm && look.text === null) {
    // Silent alarm: a big warning triangle instead of the face.
    const cx = SCREEN_W / 2;
    for (let r = 0; r < 14; r++) box(g, cx - r * 0.75, sy + 3 + r, r * 1.5 + 1, 1, '#ffd040');
    box(g, cx - 1, sy + 7, 2, 6, '#5a0c10');
    box(g, cx - 1, sy + 14, 2, 2, '#5a0c10');
    return;
  }

  // Eyes.
  const ey = sy + 6,
    lx = 20,
    rx = 38;
  if (look.eyesClosed) {
    box(g, lx, ey + 3, 6, 1, ink);
    box(g, rx, ey + 3, 6, 1, ink);
  } else if (mood === 'happy') {
    for (const ex of [lx, rx]) {
      box(g, ex, ey + 4, 2, 2, ink);
      box(g, ex + 2, ey + 2, 2, 2, ink);
      box(g, ex + 4, ey + 4, 2, 2, ink);
    }
  } else {
    const tall = mood === 'alarm' ? 7 : 6;
    box(g, lx, ey, 6, tall, ink);
    box(g, rx, ey, 6, tall, ink);
    box(g, lx + 1, ey + 1, 2, 2, '#ffffff');
    box(g, rx + 1, ey + 1, 2, 2, '#ffffff');
  }
  if (mood === 'worried' || mood === 'alarm') {
    // Brows slanting up towards the middle.
    box(g, lx, ey - 2, 3, 1, ink);
    box(g, lx + 3, ey - 3, 3, 1, ink);
    box(g, rx, ey - 3, 3, 1, ink);
    box(g, rx + 3, ey - 2, 3, 1, ink);
  }

  // Mouth: closed line (or smile), half open, open.
  const my = sy + 16,
    mx = SCREEN_W / 2;
  if (look.mouth === 0) {
    if (mood === 'happy') {
      box(g, mx - 6, my, 2, 1, ink);
      box(g, mx - 4, my + 1, 8, 1, ink);
      box(g, mx + 4, my, 2, 1, ink);
    } else if (mood === 'worried' || mood === 'alarm') {
      box(g, mx - 4, my + 1, 8, 1, ink);
      box(g, mx - 5, my + 2, 1, 1, ink);
      box(g, mx + 4, my + 2, 1, 1, ink);
    } else box(g, mx - 5, my + 1, 10, 1, ink);
  } else {
    const h = look.mouth === 1 ? 2 : 4;
    box(g, mx - 5, my, 10, h + 2, ink);
    box(g, mx - 4, my + 1, 8, h, '#06161a');
  }
}
