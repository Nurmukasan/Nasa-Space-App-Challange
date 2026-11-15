// Big world on the radar (docs/product-logic.md 7.24–7.26): a faint biome and lava-tube underlay
// so Mission Control can plan routes, plus the rover and the oxygen supply caches.
import { WORLD_MIN } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { t } from '../i18n';
import { BIOME_MAP_RES, biomeMap } from '../render/biomeMap';
import { RADAR } from './radarDraw';

const VALLEY = {
  /** Kept faint: contacts and rings must always win against the map. */
  alpha: 0.32,
  cache: '#ff9a3c',
  cacheEmpty: '#6b5a52',
  rover: '#e2ecff',
  /** Labels only when zoomed in enough to read them, map px per world px. */
  labelScale: 0.3,
};

/** Biome tints and tubes for the window `view` (screen square, before the world transform). */
export function drawValley(
  ctx: CanvasRenderingContext2D,
  salt: number,
  view: { x0: number; y0: number; span: number },
): void {
  const size = ctx.canvas.height;
  ctx.save();
  ctx.globalAlpha = VALLEY.alpha;
  ctx.imageSmoothingEnabled = false;
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
  ctx.restore();
}

/** Rover and caches, in the world layer (positions through `px`). */
export function drawExpedition(
  ctx: CanvasRenderingContext2D,
  s: EvaState,
  px: (v: number) => number,
  scale: number,
): void {
  const labels = scale >= VALLEY.labelScale;
  ctx.font = RADAR.font;
  for (const c of s.caches) {
    ctx.fillStyle = c.o2 > 0 ? VALLEY.cache : VALLEY.cacheEmpty;
    ctx.fillRect(px(c.x) - 3, px(c.y) - 3, 6, 6);
    if (labels) ctx.fillText(t('console.cache', { n: Math.round(c.o2) }), px(c.x) + 6, px(c.y) + 4);
  }
  const r = s.rover;
  if (!r) return;
  ctx.strokeStyle = ctx.fillStyle = VALLEY.rover;
  ctx.strokeRect(px(r.x) - 5, px(r.y) - 3, 10, 6);
  if (r.driver === null) ctx.fillRect(px(r.x) - 3, px(r.y) - 1, 6, 2);
  ctx.fillText(t('console.rover', { n: Math.round(r.charge * 100) }), px(r.x) + 8, px(r.y) - 6);
}
