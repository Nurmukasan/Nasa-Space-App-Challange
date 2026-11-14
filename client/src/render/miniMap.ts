import { WORLD_PX } from '@rs/shared';
import type { EvaState } from '@rs/shared';

/** Public state only. The full console may reuse this small-map renderer. */
export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  snap: EvaState,
  playerId: string,
  size = 128,
  hasWeather = false,
): void {
  const scale = size / WORLD_PX;
  const dot = (x: number, y: number, color: string, radius = 2) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * scale, y * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x * scale, y * scale, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  };
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#07191c';
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  for (const hint of snap.anomalies) circle(hint.x, hint.y, hint.r, '#a4ec9c');
  if (snap.signal.zone) {
    const zone = snap.signal.zone;
    circle(zone.x, zone.y, zone.r, '#ff5782');
  }
  ctx.setLineDash([]);
  for (const h of snap.hazards) if (h.warned && snap.t <= h.tHit) circle(h.x, h.y, h.r, '#ff7667');
  if (hasWeather) for (const d of snap.devils) circle(d.x, d.y, d.r, '#e8c28a');
  for (const s of snap.sites)
    if (s.known && (s.expiresAt === null || s.expiresAt > snap.t))
      dot(s.x, s.y, s.kind === 'signal' ? '#ff5782' : '#a4ec9c');
  for (const s of snap.stations) {
    ctx.strokeStyle = '#50e6f0';
    const x = s.x * scale,
      y = s.y * scale;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x - 3, y + 2);
    ctx.lineTo(x + 3, y + 2);
    ctx.closePath();
    ctx.stroke();
  }
  const a = snap.astronauts.find((a) => a.id === playerId);
  if (a?.waypoint) {
    circle(a.waypoint.x, a.waypoint.y, (WORLD_PX / size) * 4, '#ffce72');
    dot(a.waypoint.x, a.waypoint.y, '#ffce72', 1);
  }
  dot(snap.lander.x, snap.lander.y, '#ffffff', 3);
  if (a) {
    dot(a.x, a.y, '#50e6f0');
    ctx.strokeStyle = '#50e6f0';
    ctx.beginPath();
    ctx.moveTo(a.x * scale, a.y * scale);
    ctx.lineTo(a.x * scale + Math.cos(a.facing) * 5, a.y * scale + Math.sin(a.facing) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

export function miniMapPoint(x: number, y: number, width: number, height: number) {
  const clamp = (n: number) => Math.max(0, Math.min(WORLD_PX, n));
  return {
    x: clamp((x / Math.max(1, width)) * WORLD_PX),
    y: clamp((y / Math.max(1, height)) * WORLD_PX),
  };
}
