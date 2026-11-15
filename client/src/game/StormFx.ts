import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { audio } from '../audio';
import { prefs } from '../state/prefs';
import { gust, stormLevel } from './stormMath';

const STORM_FX = {
  farDepth: 909,
  nearDepth: 911,
  wallDepth: 912,
  flashDepth: 1400,
  farAlpha: 0.16,
  nearAlpha: 0.12,
  gustAlpha: 0.34,
  wallAlpha: 0.55,
  farSpeed: 70,
  nearSpeed: 190,
  gustSpeedMul: 2.2,
  gustShakeOn: 0.6,
  shakeMs: 800,
  shake: 0.0028,
  flashMs: 130,
  flashAlpha: 0.3,
  flashColor: 0xffd9a8,
  flashEveryMs: { min: 8000, max: 17000 },
  flashMinLevel: 0.8,
};

/** A tiny deterministic generator, so the baked textures look the same on every run. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  scene.textures.addCanvas(key, canvas);
}

/**
 * The big dust storm: two layers of wind-blown dust at different speeds, a wall of sand that
 * rolls in from the windward side with every gust, camera shudders, and now and then a static
 * discharge lights the whole view. Everything stays off in reduce-motion mode.
 */
export class StormFx {
  private far: Phaser.GameObjects.TileSprite;
  private near: Phaser.GameObjects.TileSprite;
  private wall: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Rectangle;
  private wasGusting = false;
  private nextFlashAt = 0;

  constructor(private scene: Phaser.Scene) {
    bake(scene, 'storm-wisp', 256, 128, (ctx) => {
      const rnd = lcg(7);
      for (let i = 0; i < 70; i++) {
        const y = rnd() * 128,
          x = rnd() * 256,
          len = 40 + rnd() * 140,
          h = 1 + rnd() * 3;
        const g = ctx.createLinearGradient(x, 0, x + len, 0);
        g.addColorStop(0, 'rgba(214,150,96,0)');
        g.addColorStop(0.5, `rgba(214,150,96,${0.25 + rnd() * 0.5})`);
        g.addColorStop(1, 'rgba(214,150,96,0)');
        ctx.fillStyle = g;
        // Draw twice, shifted by one tile, so the streaks wrap without a seam.
        ctx.fillRect(x, y, len, h);
        ctx.fillRect(x - 256, y, len, h);
      }
    });
    bake(scene, 'storm-wall', 256, 4, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, 'rgba(120,52,22,0.95)');
      g.addColorStop(0.45, 'rgba(160,84,40,0.45)');
      g.addColorStop(1, 'rgba(190,110,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 4);
    });
    this.far = this.layer('storm-wisp', STORM_FX.farDepth);
    this.near = this.layer('storm-wisp', STORM_FX.nearDepth).setTileScale(1.6, 1.3);
    this.wall = scene.add
      .image(0, 0, 'storm-wall')
      .setOrigin(0)
      .setDisplaySize(VIEW_W * 0.55, VIEW_H)
      .setScrollFactor(0)
      .setDepth(STORM_FX.wallDepth)
      .setAlpha(0)
      .setVisible(false);
    this.flash = scene.add
      .rectangle(0, 0, VIEW_W, VIEW_H, STORM_FX.flashColor, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(STORM_FX.flashDepth)
      .setVisible(false);
  }

  private layer(key: string, depth: number) {
    return this.scene.add
      .tileSprite(0, 0, VIEW_W, VIEW_H, key)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setAlpha(0)
      .setVisible(false);
  }

  update(snap: EvaState, now: number): void {
    const level = stormLevel(snap);
    const still = prefs.getState().reduceMotion;
    const on = level > 0 && !still;
    for (const o of [this.far, this.near, this.wall]) o.setVisible(on);
    if (!on) {
      this.wasGusting = false;
      return;
    }
    const g = gust(snap.t),
      push = 1 + g * STORM_FX.gustSpeedMul;
    this.far
      .setAlpha(level * (STORM_FX.farAlpha + g * STORM_FX.gustAlpha * 0.5))
      .setTilePosition(snap.t * STORM_FX.farSpeed * push, snap.t * 6);
    this.near
      .setAlpha(level * (STORM_FX.nearAlpha + g * STORM_FX.gustAlpha))
      .setTilePosition(snap.t * STORM_FX.nearSpeed * push, snap.t * 14);
    this.wall.setAlpha(level * g * STORM_FX.wallAlpha);

    const gusting = g > STORM_FX.gustShakeOn;
    if (gusting && !this.wasGusting) {
      this.scene.cameras.main.shake(STORM_FX.shakeMs, STORM_FX.shake * level);
      audio.sfx('storm_gust', { volume: level });
    }
    this.wasGusting = gusting;

    if (level >= STORM_FX.flashMinLevel && now >= this.nextFlashAt) {
      if (this.nextFlashAt > 0) {
        this.flash.setVisible(true).setAlpha(STORM_FX.flashAlpha);
        this.scene.tweens.add({
          targets: this.flash,
          alpha: 0,
          duration: STORM_FX.flashMs,
          onComplete: () => this.flash.setVisible(false),
        });
        audio.sfx('storm_crack', { volume: level });
      }
      const { min, max } = STORM_FX.flashEveryMs;
      this.nextFlashAt = now + min + Math.random() * (max - min);
    }
  }
}
