import type Phaser from 'phaser';
import { placeholderSheet } from './placeholder';
import { ASSETS as MANIFEST } from './assetManifest';

/** Field spritesheets only; React screens read 'ui' images from the same manifest. */
export const ASSETS = MANIFEST.filter((a) => a.use === 'field');
export const spriteFiles = import.meta.glob('/public/assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Only request files present in the manifest, so an empty art folder produces no 404s. */
export function preloadAssets(scene: Phaser.Scene): void {
  for (const a of ASSETS)
    if (spriteFiles[`/public/assets/sprites/${a.key}.png`] && !scene.textures.exists(a.key))
      scene.load.spritesheet(a.key, `${import.meta.env.BASE_URL}assets/sprites/${a.key}.png`, {
        frameWidth: a.width,
        frameHeight: a.height,
      });
}

export function ensureAssets(scene: Phaser.Scene): void {
  for (const a of ASSETS) {
    if (scene.textures.exists(a.key)) continue;
    const canvas = placeholderSheet(a);
    const texture = scene.textures.addCanvas(a.key, canvas)!;
    for (let frame = 0; frame < a.frames; frame++)
      texture.add(frame, 0, frame * a.width, 0, a.width, a.height);
  }
}
