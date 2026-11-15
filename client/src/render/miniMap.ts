import { LANDER_POS, WORLD_MAX, WORLD_MIN, WORLD_PX } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { BIOME_MAP_RES, biomeMap } from './biomeMap';

/** The square of the world a small map shows. */
export interface MapView {
  x0: number;
  y0: number;
  span: number;
}

/** The whole world. */
export const FULL_VIEW: MapView = { x0: WORLD_MIN, y0: WORLD_MIN, span: WORLD_PX };
/** The classic landing area (v1 world): what the classic scenarios always showed. */
const LANDING_SPAN = 1536;
/** Big world: the wrist map follows its wearer over this span, px. */
const WRIST_SPAN = 2048;

/** Classic scenarios: the landing area; big world: a window around the player. */
export function miniMapView(snap: EvaState, playerId: string, bigWorld: boolean): MapView {
  if (!bigWorld)
    return {
      x0: LANDER_POS.x - LANDING_SPAN / 2,
      y0: LANDER_POS.y - LANDING_SPAN / 2,
      span: LANDING_SPAN,
    };
  const a = snap.astronauts.find((x) => x.id === playerId) ?? snap.lander;
  const clamp = (v: number) => Math.max(WORLD_MIN, Math.min(WORLD_MAX - WRIST_SPAN, v));
  return { x0: clamp(a.x - WRIST_SPAN / 2), y0: clamp(a.y - WRIST_SPAN / 2), span: WRIST_SPAN };
}

/** Public state only. The full console may reuse this small-map renderer. */
export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  snap: EvaState,
  playerId: string,
  size = 128,
  hasWeather = false,
  view: MapView = miniMapView(snap, playerId, false),
  salt: number | null = null,
): void {
  const scale = size / view.span;
  const sx = (x: number) => (x - view.x0) * scale,
    sy = (y: number) => (y - view.y0) * scale;
  const dot = (x: number, y: number, color: string, radius = 2) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx(x), sy(y), radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(sx(x), sy(y), Math.max(1.5, r * scale), 0, Math.PI * 2);
    ctx.stroke();
  };
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#07191c';
  ctx.fillRect(0, 0, size, size);
  if (salt !== null) {
    // Big world: biome tints and lava tubes under the markers, dimmed to keep them readable.
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(
      biomeMap(salt),
      (view.x0 - WORLD_MIN) / BIOME_MAP_RES,
      (view.y0 - WORLD_MIN) / BIOME_MAP_RES,
      view.span / BIOME_MAP_RES,
      view.span / BIOME_MAP_RES,
      0,
      0,
      size,
      size,
    );
    ctx.globalAlpha = 1;
  }
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
  for (const c of snap.caches) {
    ctx.fillStyle = c.o2 > 0 ? '#ff9a3c' : '#6b5a52';
    ctx.fillRect(Math.round(sx(c.x)) - 2, Math.round(sy(c.y)) - 2, 4, 4);
  }
  for (const s of snap.stations) {
    ctx.strokeStyle = '#50e6f0';
    const x = sx(s.x),
      y = sy(s.y);
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x - 3, y + 2);
    ctx.lineTo(x + 3, y + 2);
    ctx.closePath();
    ctx.stroke();
  }
  const a = snap.astronauts.find((a) => a.id === playerId);
  if (a?.waypoint) {
    circle(a.waypoint.x, a.waypoint.y, 4 / scale, '#ffce72');
    dot(a.waypoint.x, a.waypoint.y, '#ffce72', 1);
  }
  dot(snap.lander.x, snap.lander.y, '#ffffff', 3);
  const rover = snap.rover;
  if (rover && rover.driver !== playerId) {
    ctx.fillStyle = '#e2ecff';
    ctx.fillRect(Math.round(sx(rover.x)) - 3, Math.round(sy(rover.y)) - 2, 6, 4);
  }
  if (a) {
    dot(a.x, a.y, '#50e6f0');
    ctx.strokeStyle = '#50e6f0';
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(a.x) + Math.cos(a.facing) * 5, sy(a.y) + Math.sin(a.facing) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Map click → world point, from the rendered rectangle (works for CSS-resized maps). */
export function miniMapPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  view: MapView = FULL_VIEW,
) {
  const clamp = (n: number) => Math.max(WORLD_MIN, Math.min(WORLD_MAX, n));
  return {
    x: clamp(view.x0 + (x / Math.max(1, width)) * view.span),
    y: clamp(view.y0 + (y / Math.max(1, height)) * view.span),
  };
}
