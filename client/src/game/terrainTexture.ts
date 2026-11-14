import type Phaser from 'phaser';
import { WORLD_PX, levelAt } from '@rs/shared';
import type { SampleSite } from '@rs/shared';
import { decorateTerrain } from './terrainDecor';
import { terrainPaint } from '../render/terrainPaint';
import { FIELD } from './style';

export function terrainTexture(
  scene: Phaser.Scene,
  salt: number,
  sites: SampleSite[] = [],
): number {
  const start = performance.now();
  const draw = (scale: number) => {
    const size = WORLD_PX / scale,
      levels = new Uint8Array(size * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) levels[y * size + x] = levelAt(x * scale, y * scale, salt);
    const pixels = terrainPaint(levels, size, size);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas
      .getContext('2d')!
      .putImageData(new ImageData(new Uint8ClampedArray(pixels), size, size), 0, 0);
    decorateTerrain(canvas.getContext('2d')!, scale, salt, sites);
    return canvas;
  };
  let canvas = draw(1),
    scale = 1;
  const fullMs = performance.now() - start;
  if (fullMs > FIELD.terrainBudgetMs) {
    canvas = draw(2);
    scale = 2;
  }
  if (scene.textures.exists('terrain')) scene.textures.remove('terrain');
  scene.textures.addCanvas('terrain', canvas);
  scene.add.image(0, 0, 'terrain').setOrigin(0).setScale(scale).setDepth(-100);
  const ms = performance.now() - start;
  scene.registry.set('terrainMs', ms);
  scene.registry.set('terrainScale', scale);
  if (import.meta.env.DEV)
    console.info(
      `[field] terrain ${ms.toFixed(1)}ms (full ${fullMs.toFixed(1)}ms, scale ${scale})`,
    );
  return ms;
}
