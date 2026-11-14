// Moving field hazards on the radar: dust devils, seen only with a weather station (PL 7.14).
import type { EvaState } from '@rs/shared';
import { t } from '../i18n';
import { RADAR } from './radarDraw';

export function drawDevils(
  ctx: CanvasRenderingContext2D,
  s: EvaState,
  scale: number,
  visible: boolean,
): void {
  if (!visible || s.devils.length === 0) return;
  ctx.strokeStyle = ctx.fillStyle = RADAR.site;
  ctx.setLineDash([2, 3]);
  for (const d of s.devils) {
    const x = Math.round(d.x * scale),
      y = Math.round(d.y * scale);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, d.r * scale), 0, Math.PI * 2);
    ctx.stroke();
    // Heading tick: where it is drifting.
    const v = Math.hypot(d.vx, d.vy) || 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (d.vx / v) * 14, y + (d.vy / v) * 14);
    ctx.stroke();
    ctx.fillText(t('console.devil'), x + 8, y - 8);
  }
  ctx.setLineDash([]);
}
