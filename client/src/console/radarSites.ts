import { RADAR, drawDiamond } from './radarDraw';

/** A sample site: diamond sized by richness, one pip per tier, filled while still in the ground. */
export function drawSite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  richness: 1 | 2 | 3,
  left: number,
  total: number,
  label: string,
) {
  const r = 3 + richness * 2;
  ctx.fillStyle = RADAR.site;
  ctx.strokeStyle = RADAR.site;
  drawDiamond(ctx, x, y, r);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const gap = 6,
    start = x - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    const px = start + i * gap,
      py = y + r + 8;
    if (i < left) ctx.fillRect(px - 2, py - 2, 4, 4);
    else ctx.strokeRect(px - 2, py - 2, 4, 4);
  }
  ctx.fillStyle = RADAR.text;
  ctx.fillText(label, x + r + 5, y + 4);
}
