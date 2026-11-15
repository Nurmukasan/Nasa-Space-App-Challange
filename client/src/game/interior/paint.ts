// Shared palette and tiny drawing helpers for the interior art (canvas 2D, whole pixels).

export const P = {
  rim: '#14161b',
  wall: '#2b3039',
  wallTop: '#454c58',
  wallHi: '#5f6774',
  seam: '#4c525c',
  seamLight: '#7a818b',
  stripe: '#f2c230',
  metal: '#8d96a3',
  metalHi: '#b9c1cc',
  metalDark: '#555d69',
  metalDeep: '#3a404b',
  screen: '#0c1c26',
  screenGlow: '#36d6e0',
  screenDim: '#1d6f7a',
  wood: '#9a6a3c',
  woodDark: '#6a4424',
  soil: '#5c3a22',
  leaf: '#4f9e3a',
  leafDark: '#2f6e2a',
  leafHi: '#9ad860',
  flower: '#e2584c',
  bloom: '#f2c230',
  violet: '#9a6ad0',
  water: '#2f7fd0',
  waterHi: '#8fd0ff',
  green: '#3ec44e',
  greenHi: '#b6f0a0',
  cloth: '#c06a34',
  clothHi: '#e09050',
  sheet: '#dfe3ea',
  red: '#d03a30',
  blue: '#3a6ab0',
  rock: '#7a7068',
  rockHi: '#a49890',
};

type Ctx = CanvasRenderingContext2D;

export function box(g: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  if (w <= 0 || h <= 0) return;
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Furniture block: dark outline, body colour, lit top edge and a shaded bottom. */
export function block(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  body: string,
  top: string,
  shade = P.metalDeep,
): void {
  box(g, x, y, w, h, P.rim);
  box(g, x + 1, y + 1, w - 2, h - 2, body);
  box(g, x + 1, y + 1, w - 2, 2, top);
  box(g, x + 1, y + h - 3, w - 2, 2, shade);
}

/** Small monitor: bezel and a glowing screen with two lines of "data". */
export function monitor(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  glow = P.screenGlow,
): void {
  box(g, x, y, w, h, P.rim);
  box(g, x + 1, y + 1, w - 2, h - 2, P.metalDark);
  box(g, x + 2, y + 2, w - 4, h - 4, P.screen);
  box(g, x + 3, y + 3, Math.max(1, w - 8), 1, glow);
  if (h > 7) box(g, x + 3, y + 5, Math.max(1, w - 10), 1, P.screenDim);
  if (h > 9) box(g, x + 3, y + 7, Math.max(1, w - 7), 1, glow);
}

/** Round-ish glass tank with liquid, cap and a highlight stripe. */
export function tank(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  liquid: string,
  hi: string,
): void {
  box(g, x + 1, y, w - 2, h, P.rim);
  box(g, x, y + 1, w, h - 2, P.rim);
  box(g, x + 1, y + 1, w - 2, h - 2, liquid);
  box(g, x + 1, y + 1, w - 2, 3, P.metalHi); // cap
  box(g, x + 1, y + h - 4, w - 2, 3, P.metal); // base
  box(g, x + 3, y + 5, 2, h - 10, hi);
}

/** A leafy plant centred on (cx, base), `size` 1..3. */
export function plant(g: Ctx, cx: number, base: number, size: number, flower?: string): void {
  const h = 4 + size * 3;
  box(g, cx, base - h, 1, h, P.leafDark);
  for (let i = 0; i < size + 1; i++) {
    const y = base - 3 - i * 3;
    box(g, cx - 3, y, 3, 2, i % 2 ? P.leaf : P.leafDark);
    box(g, cx + 1, y - 1, 3, 2, P.leaf);
  }
  box(g, cx - 1, base - h - 1, 3, 2, P.leafHi);
  if (flower) box(g, cx - 1, base - h - 3, 3, 3, flower);
}
