import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { prefs } from '../state/prefs';
import { FIELD } from './style';
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Radial lights and 16 cones are baked once, including the four-level Bayer alpha. */
export function makeLightTexture(
  scene: Phaser.Scene,
  key: string,
  radius: number,
  direction?: number,
): void {
  if (scene.textures.exists(key)) return;
  const size = radius * 2,
    tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext(),
    img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - radius,
        dy = y + 0.5 - radius,
        d = Math.hypot(dx, dy) / radius;
      let reach = 1;
      if (direction !== undefined) {
        const angle = Math.atan2(dy, dx) - direction;
        const delta = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
        reach = delta < 0.65 ? 1 : 0.27;
      }
      const level = Math.floor((1 - d / reach) * 4.2 + BAYER4[(y & 3) * 4 + (x & 3)]! / 16 - 0.35);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = level <= 0 ? 0 : level === 1 ? 115 : level === 2 ? 204 : 255;
    }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}
export interface Light {
  x: number;
  y: number;
  key: string;
  r: number;
}
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private tint: Phaser.GameObjects.Rectangle;
  private glow: Phaser.GameObjects.Image;
  private aurora: Phaser.GameObjects.Graphics;
  private haze: Phaser.GameObjects.TileSprite;
  constructor(scene: Phaser.Scene) {
    makeLightTexture(scene, 'light-ship', FIELD.landerRadius);
    makeLightTexture(scene, 'light-friend', FIELD.companionRadius);
    for (let i = 0; i < FIELD.coneDirections; i++)
      makeLightTexture(
        scene,
        `light-cone-${i}`,
        FIELD.helmetRadius,
        (i * Math.PI * 2) / FIELD.coneDirections,
      );
    this.rt = scene.add
      .renderTexture(0, 0, VIEW_W, VIEW_H)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(900);
    this.brush = scene.make.image({ key: 'light-ship', add: false });
    this.tint = scene.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0xffc090, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(899);
    this.glow = scene.add
      .image(768, 768, 'light-ship')
      .setTint(0xffb960)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(905)
      .setAlpha(0);
    if (!scene.textures.exists('storm-haze')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++) {
          if (((x + y * 3) & 15) < BAYER4[(y & 3) * 4 + (x & 3)]! / 2) {
            ctx.fillStyle = '#b5866c';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      scene.textures.addCanvas('storm-haze', canvas);
    }
    this.haze = scene.add
      .tileSprite(0, 0, VIEW_W, VIEW_H, 'storm-haze')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(910)
      .setAlpha(0);
    this.aurora = scene.add.graphics().setScrollFactor(0).setDepth(906);
    const cleanup = () => {
      scene.events.off('shutdown', cleanup);
      scene.events.off('destroy', cleanup);
      this.brush.destroy();
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
  }
  render(snap: EvaState, lights: Light[], cam: Phaser.Cameras.Scene2D.Camera): void {
    const ambient = snap.weather.light,
      storm = snap.weather.storm;
    const active = !!storm && snap.t >= storm.tStart && snap.t < storm.tEnd;
    const dark = Math.min(0.94, 1 - ambient + (active ? 0.12 : 0));
    const flare = snap.flare && snap.t >= snap.flare.tStart && snap.t < snap.flare.tEnd;
    const reduce = prefs.getState().reduceMotion;
    const own = lights.find((l) => l.key.startsWith('light-cone-'));
    const inDevil = own && snap.devils.some((d) => Math.hypot(own.x - d.x, own.y - d.y) <= d.r);
    this.aurora.clear();
    if (flare && ambient < 0.5) {
      this.aurora.lineStyle(3, 0x8bff9c, 0.13);
      for (let band = 0; band < 3; band++) {
        this.aurora.beginPath();
        for (let x = 0; x <= VIEW_W; x += 8) {
          const y = 18 + band * 11 + Math.sin(x / 40 + (reduce ? 0 : snap.t * 0.15) + band) * 6;
          if (x === 0) this.aurora.moveTo(x, y);
          else this.aurora.lineTo(x, y);
        }
        this.aurora.strokePath();
      }
    }
    this.rt.clear();
    this.tint.setFillStyle(
      flare ? 0x80c291 : ambient > 0.5 ? 0xffb36a : 0x283b88,
      flare ? 0.1 : ambient > 0.5 ? 0.035 : 0.07,
    );
    this.glow.setAlpha(dark * 0.12);
    if (dark > 0.02) {
      this.rt.fill(FIELD.night, dark);
      for (const light of lights) {
        this.brush
          .setTexture(light.key)
          .setDisplaySize(light.r * 2 * (active ? 0.65 : 1), light.r * 2 * (active ? 0.65 : 1))
          .setPosition(Math.round(light.x - cam.scrollX), Math.round(light.y - cam.scrollY));
        this.rt.erase(this.brush);
      }
    }
    this.haze.setAlpha(inDevil ? 0.6 : active ? 0.24 : 0);
    if ((active || inDevil) && !reduce) {
      this.haze.tilePositionX = snap.t * 9;
      this.haze.tilePositionY = snap.t * 2;
    }
  }
}
