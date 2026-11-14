import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '@rs/shared';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const NIGHT_COLOR = 0x0a081e;
const MAX_DARK = 0.9;

/**
 * Pre-renders a dithered radial light into a texture. The dithering is baked into
 * the alpha channel, so the "pixel-art light" look costs nothing at runtime.
 */
export function makeLightTexture(scene: Phaser.Scene, key: string, radius: number): void {
  if (scene.textures.exists(key)) return;
  const size = radius * 2;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - radius, y + 0.5 - radius) / radius;
      const level = Math.floor((1 - d) * 4.2 + BAYER4[(y & 3) * 4 + (x & 3)]! / 16 - 0.35);
      const alpha = level <= 0 ? 0 : level === 1 ? 0.45 : level === 2 ? 0.8 : 1;
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(alpha * 255);
    }
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

/** Screen-sized darkness layer; lights are erased out of it every frame. */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;

  constructor(scene: Phaser.Scene) {
    this.rt = scene.add
      .renderTexture(0, 0, VIEW_W, VIEW_H)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
  }

  /** ambient: 1 = daylight (no darkness), 0 = pitch black. */
  render(ambient: number, lights: Light[], cam: Phaser.Cameras.Scene2D.Camera): void {
    this.rt.clear();
    const dark = Math.min(MAX_DARK, 1 - ambient);
    if (dark <= 0.02) return;
    this.rt.fill(NIGHT_COLOR, dark);
    for (const l of lights) {
      this.rt.erase(
        l.key,
        Math.round(l.x - cam.scrollX - l.r),
        Math.round(l.y - cam.scrollY - l.r),
      );
    }
  }
}
