// Big-world props on the field: the rover and the oxygen supply caches (docs/product-logic.md
// 7.25, 7.26). Textures are drawn in code, top-down, lit from the upper left like the terrain.
import type Phaser from 'phaser';
import type { EvaState } from '@rs/shared';
import { worldLabels } from './WorldLabels';
import { evaText } from '../i18n/en/eva';

const ROVER_W = 30,
  ROVER_H = 20;
const CACHE_W = 12,
  CACHE_H = 14;
/** Show a cache's oxygen label within this distance, px. */
const LABEL_DIST = 140;

type Ctx = CanvasRenderingContext2D;
const px = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** Two frames: facing east, facing south. West and north are flips. */
function roverTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('rover')) return;
  const canvas = document.createElement('canvas');
  canvas.width = ROVER_W * 2;
  canvas.height = ROVER_H + 10;
  const ctx = canvas.getContext('2d')!;
  // East-facing: long body, cab windows at the front (right).
  for (const [wx, wy] of [
    [3, 1],
    [12, 1],
    [21, 1],
    [3, 16],
    [12, 16],
    [21, 16],
  ] as const)
    px(ctx, wx, wy, 6, 3, '#26242c');
  px(ctx, 2, 4, 26, 12, '#d8dee8');
  px(ctx, 2, 4, 26, 1, '#f4f7fb');
  px(ctx, 2, 15, 26, 1, '#8c96a8');
  px(ctx, 2, 9, 26, 2, '#ff7828');
  px(ctx, 21, 5, 6, 4, '#2f8fb4');
  px(ctx, 21, 11, 6, 4, '#2f8fb4');
  px(ctx, 22, 6, 2, 1, '#9fe6ff');
  px(ctx, 6, 6, 4, 3, '#a7b2c4');
  px(ctx, 7, 6, 1, 1, '#50e6f0');
  // South-facing: rotated layout in the second frame (offset ROVER_W).
  const o = ROVER_W;
  for (const [wx, wy] of [
    [1, 1],
    [1, 10],
    [1, 19],
    [16, 1],
    [16, 10],
    [16, 19],
  ] as const)
    px(ctx, o + wx, wy, 3, 6, '#26242c');
  px(ctx, o + 4, 0, 12, 27, '#d8dee8');
  px(ctx, o + 4, 0, 1, 27, '#f4f7fb');
  px(ctx, o + 15, 0, 1, 27, '#8c96a8');
  px(ctx, o + 9, 0, 2, 27, '#ff7828');
  px(ctx, o + 5, 19, 4, 6, '#2f8fb4');
  px(ctx, o + 11, 19, 4, 6, '#2f8fb4');
  px(ctx, o + 6, 4, 3, 4, '#a7b2c4');
  const tex = scene.textures.addCanvas('rover', canvas)!;
  tex.add(0, 0, 0, 0, ROVER_W, ROVER_H);
  tex.add(1, 0, o, 0, ROVER_W - 10, ROVER_H + 10);
}

/** Two frames: stocked, empty. */
function cacheTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('cache')) return;
  const canvas = document.createElement('canvas');
  canvas.width = CACHE_W * 2;
  canvas.height = CACHE_H;
  const ctx = canvas.getContext('2d')!;
  for (let f = 0; f < 2; f++) {
    const o = f * CACHE_W;
    const body = f === 0 ? '#c9ced8' : '#7d828c';
    px(ctx, o + 2, 3, 8, 10, body);
    px(ctx, o + 2, 3, 8, 1, '#eef2f8');
    px(ctx, o + 9, 3, 1, 10, '#6b7280');
    px(ctx, o + 2, 7, 8, 2, f === 0 ? '#ff7828' : '#6b4a3a');
    px(ctx, o + 4, 0, 4, 3, '#9aa3b2');
    px(ctx, o + 5, 1, 2, 1, f === 0 ? '#50e6f0' : '#3a3f48');
    px(ctx, o + 1, 12, 10, 2, 'rgba(20,8,12,0.45)');
  }
  const tex = scene.textures.addCanvas('cache', canvas)!;
  tex.add(0, 0, 0, 0, CACHE_W, CACHE_H);
  tex.add(1, 0, CACHE_W, 0, CACHE_W, CACHE_H);
}

export class ExpeditionLayer {
  private rover: Phaser.GameObjects.Sprite | null = null;
  private caches = new Map<string, Phaser.GameObjects.Sprite>();
  constructor(private scene: Phaser.Scene) {
    roverTexture(scene);
    cacheTexture(scene);
  }

  /** `meX/meY`: our own predicted position, used when we are the driver. */
  update(snap: EvaState, myId: string, meX: number, meY: number): void {
    const r = snap.rover;
    if (r) {
      if (!this.rover) this.rover = this.scene.add.sprite(r.x, r.y, 'rover', 0);
      const mine = r.driver === myId;
      const x = mine ? meX : r.x,
        y = mine ? meY : r.y;
      const c = Math.cos(r.facing),
        s = Math.sin(r.facing);
      const horizontal = Math.abs(c) >= Math.abs(s);
      this.rover
        .setPosition(Math.round(x), Math.round(y))
        .setFrame(horizontal ? 0 : 1)
        .setFlip(horizontal && c < 0, !horizontal && s < 0)
        .setDepth(y + ROVER_H / 2)
        .setVisible(snap.t >= 0);
    }
    for (const cache of snap.caches) {
      let sprite = this.caches.get(cache.id);
      if (!sprite) {
        sprite = this.scene.add.sprite(cache.x, cache.y, 'cache', 0).setDepth(cache.y);
        this.caches.set(cache.id, sprite);
      }
      sprite.setFrame(cache.o2 > 0 ? 0 : 1);
      if (Math.hypot(cache.x - meX, cache.y - meY) < LABEL_DIST)
        worldLabels(this.scene).set(
          `cache:${cache.id}`,
          evaText('eva.cache_label', { n: Math.round(cache.o2) }),
          cache.x,
          cache.y - 16,
          'name',
        );
    }
  }
}
