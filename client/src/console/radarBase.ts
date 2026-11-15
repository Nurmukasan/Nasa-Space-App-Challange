const BASE = {
  /** Deep radar blue in the middle, darker toward the edges. */
  centre: [14, 52, 96],
  edge: [4, 14, 30],
  /** How far out the darkening starts, as a fraction of the half-size. */
  falloff: 1.25,
  /** Faint scan lines, so the flat blue still reads as a screen. */
  scanStep: 4,
  scanColor: 'rgba(120, 190, 255, 0.045)',
};

/**
 * The radar backdrop: plain blue, no terrain. Craters and ridges belong to the field view;
 * the operator's screen shows only the grid, the rings and the contacts.
 */
export function buildBasemap(size: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d')!;
  const half = size / 2;
  const glow = ctx.createRadialGradient(half, half, 0, half, half, half * BASE.falloff);
  glow.addColorStop(0, `rgb(${BASE.centre.join(',')})`);
  glow.addColorStop(1, `rgb(${BASE.edge.join(',')})`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = BASE.scanColor;
  for (let y = 0; y < size; y += BASE.scanStep) ctx.fillRect(0, y, size, 1);
  return out;
}
