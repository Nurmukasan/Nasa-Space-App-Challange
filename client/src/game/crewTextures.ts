import type Phaser from 'phaser';
import { CREW_CLASS_IDS } from '@rs/shared';
import type { CrewClassId } from '@rs/shared';
import { CREW_FRAME, CREW_FRAMES, crewSheet } from './crewArt';

const cache = new Map<CrewClassId, HTMLCanvasElement>();

/** The class sprite strip as a canvas (drawn once per class). */
export function crewCanvas(id: CrewClassId): HTMLCanvasElement {
  let canvas = cache.get(id);
  if (!canvas) {
    const sheet = crewSheet(id);
    canvas = document.createElement('canvas');
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(sheet.width, sheet.height);
    image.data.set(sheet.data);
    ctx.putImageData(image, 0, 0);
    cache.set(id, canvas);
  }
  return canvas;
}

export const crewKey = (id: CrewClassId): string => `crew_${id}`;

/** Registers one Phaser spritesheet per crew class; safe to call on every scene start. */
export function ensureCrewTextures(textures: Phaser.Textures.TextureManager): void {
  for (const id of CREW_CLASS_IDS) {
    if (textures.exists(crewKey(id))) continue;
    // Phaser keeps its own copy of the source, so a fresh canvas is used per game.
    const src = crewCanvas(id);
    const copy = document.createElement('canvas');
    copy.width = src.width;
    copy.height = src.height;
    copy.getContext('2d')!.drawImage(src, 0, 0);
    const texture = textures.addCanvas(crewKey(id), copy)!;
    for (let f = 0; f < CREW_FRAMES; f++)
      texture.add(f, 0, f * CREW_FRAME, 0, CREW_FRAME, CREW_FRAME);
  }
}
