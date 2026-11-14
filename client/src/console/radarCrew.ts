import { RADAR } from './radarDraw';

const TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;

export const LEVEL_COLOR = { ok: RADAR.ok, warn: RADAR.amber, lost: RADAR.danger } as const;

/** Everything farther from the lander than this is a one-way trip for this astronaut. */
export function drawReturnRing(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: string,
  selected: boolean,
  label: string,
  slot: number,
) {
  if (r < 6) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = selected ? 0.95 : 0.4;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.setLineDash(selected ? [10, 6] : [3, 7]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // Label sits on the ring at a different angle per crew so labels never stack.
  const a = -Math.PI / 2 + 0.55 + slot * 0.9;
  const x = cx + Math.cos(a) * r,
    y = cy + Math.sin(a) * r;
  ctx.globalAlpha = selected ? 1 : 0.7;
  ctx.fillStyle = '#100808cc';
  const w = ctx.measureText(label).width + 8;
  ctx.fillRect(x - w / 2, y - 9, w, 16);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 4);
  ctx.textAlign = 'left';
  ctx.restore();
}

/** Line from an astronaut back to the lander, coloured by how safe the walk home is. */
export function drawTether(
  ctx: Ctx,
  x: number,
  y: number,
  hx: number,
  hy: number,
  level: keyof typeof LEVEL_COLOR,
  label: string | null,
) {
  const color = LEVEL_COLOR[level];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = level === 'ok' ? 0.22 : 0.8;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    const mx = (x + hx) / 2,
      my = (y + hy) / 2;
    ctx.globalAlpha = 1;
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = '#100808dd';
    ctx.fillRect(mx - w / 2, my - 9, w, 16);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my + 4);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** Where a crew member who dropped off the link could be by now. */
export function drawGhostZone(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.setLineDash([4, 5]);
  ctx.stroke();
  ctx.restore();
}

/** 100 m scale bar, bottom left. */
export function drawScaleBar(ctx: Ctx, x: number, y: number, widthPx: number, label: string) {
  ctx.strokeStyle = RADAR.text;
  ctx.fillStyle = RADAR.text;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y);
  ctx.lineTo(x + widthPx, y);
  ctx.lineTo(x + widthPx, y - 4);
  ctx.stroke();
  ctx.fillText(label, x + 4, y - 7);
}
