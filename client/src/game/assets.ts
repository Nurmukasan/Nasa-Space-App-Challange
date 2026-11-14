import type Phaser from 'phaser';
import { MODULE_ORDER, RELAYS, VEHICLES } from '@rs/shared';

interface Asset {
  key: string;
  width: number;
  height: number;
  frames: number;
}
export const ASSETS: Asset[] = [
  { key: 'astronaut', width: 16, height: 16, frames: 9 },
  { key: 'astronaut_stripe', width: 16, height: 16, frames: 9 },
  { key: 'lander', width: 128, height: 96, frames: 1 },
  ...['delta', 'crater', 'basalt', 'impact'].map((kind) => ({
    key: `site_${kind}`,
    width: 16,
    height: 16,
    frames: 2,
  })),
  { key: 'samples', width: 8, height: 8, frames: 3 },
  { key: 'station', width: 16, height: 16, frames: 1 },
  { key: 'beacon', width: 16, height: 24, frames: 6 },
  ...[1, 2, 3].map((n) => ({ key: `rock_${n}`, width: 16, height: 16, frames: 1 })),
  ...['dust', 'spark'].map((kind) => ({ key: `fx_${kind}`, width: 8, height: 8, frames: 4 })),
  ...[
    ...MODULE_ORDER.map((id) => `icon_${id}`),
    ...Object.keys(VEHICLES).map((id) => `icon_vehicle_${id}`),
    ...Object.keys(RELAYS).map((id) => `icon_relay_${id}`),
  ].map((key) => ({ key, width: 32, height: 32, frames: 1 })),
];
const files = import.meta.glob('/public/assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Only request files present in the manifest, so an empty art folder produces no 404s. */
export function preloadAssets(scene: Phaser.Scene): void {
  for (const a of ASSETS)
    if (files[`/public/assets/sprites/${a.key}.png`] && !scene.textures.exists(a.key))
      scene.load.spritesheet(a.key, `${import.meta.env.BASE_URL}assets/sprites/${a.key}.png`, {
        frameWidth: a.width,
        frameHeight: a.height,
      });
}

export function ensureAssets(scene: Phaser.Scene): void {
  for (const a of ASSETS) {
    if (scene.textures.exists(a.key)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = a.width * a.frames;
    canvas.height = a.height;
    const ctx = canvas.getContext('2d')!;
    for (let frame = 0; frame < a.frames; frame++) {
      ctx.save();
      ctx.translate(frame * a.width, 0);
      if (a.key === 'astronaut_stripe') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(4, frame === 8 ? 10 : 7, 8, 2);
      } else if (a.key === 'astronaut') {
        const bob = frame >= 2 && frame < 6 ? frame % 2 : 0;
        ctx.fillStyle = '#20243c';
        ctx.fillRect(3, 3 + bob, 10, 11);
        ctx.fillStyle = '#e2ecff';
        ctx.fillRect(4, 2 + bob, 8, 7);
        ctx.fillRect(4, 9, 8, 4);
        ctx.fillStyle = '#295868';
        ctx.fillRect(6, 4 + bob, 5, 3);
        ctx.fillStyle = '#b0b6c4';
        ctx.fillRect(4, 13, 3, 2 - bob);
        ctx.fillRect(9, 13, 3, 1 + bob);
        if (frame >= 6 && frame < 8) {
          ctx.fillStyle = '#ffce72';
          ctx.fillRect(12, 8, 2, 7);
        }
        if (frame === 8) {
          ctx.clearRect(0, 0, 16, 16);
          ctx.fillStyle = '#b0b6c4';
          ctx.fillRect(2, 10, 12, 5);
        }
      } else if (a.key === 'lander') {
        ctx.fillStyle = '#252c45';
        ctx.fillRect(8, 10, 48, 30);
        ctx.fillStyle = '#c9d8e8';
        ctx.fillRect(12, 6, 40, 30);
        ctx.fillStyle = '#50e6f0';
        ctx.fillRect(26, 20, 12, 20);
        ctx.fillStyle = '#323d58';
        ctx.fillRect(4, 38, 12, 4);
        ctx.fillRect(48, 38, 12, 4);
      } else if (a.key.startsWith('site_')) {
        ctx.fillStyle = frame ? '#43282f' : a.key === 'site_impact' ? '#b8dfed' : '#ffce72';
        ctx.fillRect(3, 5, 10, 8);
        ctx.fillStyle = '#805044';
        ctx.fillRect(5, 3, 6, 2);
        if (frame) {
          ctx.fillStyle = '#1c1828';
          ctx.fillRect(5, 7, 6, 5);
        }
      } else if (a.key === 'beacon') {
        ctx.strokeStyle = '#50e6f0';
        ctx.strokeRect(
          3 - (frame % 2),
          3 - (frame % 2),
          10 + (frame % 2) * 2,
          10 + (frame % 2) * 2,
        );
        ctx.fillStyle = '#e2ecff';
        ctx.fillRect(7, 5, 2, 6);
      } else if (a.key === 'station') {
        ctx.fillStyle = '#c9d8e8';
        ctx.fillRect(3, 8, 10, 5);
        ctx.fillStyle = '#50e6f0';
        ctx.fillRect(7, 2, 2, 8);
      } else {
        ctx.fillStyle = a.key.includes('spark') ? '#ffce72' : '#ac7960';
        ctx.fillRect(2, 2, Math.max(2, a.width - 4), Math.max(2, a.height - 4));
      }
      ctx.restore();
    }
    const texture = scene.textures.addCanvas(a.key, canvas)!;
    for (let frame = 0; frame < a.frames; frame++)
      texture.add(frame, 0, frame * a.width, 0, a.width, a.height);
  }
}
