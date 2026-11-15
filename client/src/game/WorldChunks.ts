// Streams the big world in square chunks around the camera (docs/architecture.md 8.3, 10).
// One 5632 px texture would cost >100 MB; chunks near the view are painted within a per-frame
// budget, far ones are dropped. Painting is deterministic, so a chunk comes back identical.
import type Phaser from 'phaser';
import { WORLD_MAX, WORLD_MIN } from '@rs/shared';
import type { Vec2 } from '@rs/shared';
import { paintRegion } from '../render/worldPaint';
import { CHUNK, decorateChunk } from './chunkDecor';

/** Extra ring of chunks painted ahead of the view, px. */
const PREFETCH = 160;
/** Chunks farther than this from the view are released, px. */
const KEEP = 720;
/** Painting time per frame once the mission runs, ms. */
const FRAME_BUDGET_MS = 5;
/** Below every world-sorted sprite (depth = world y, -2048..3584). */
const DEPTH = -30000;

interface Chunk {
  key: string;
  image: Phaser.GameObjects.Image;
}

export class WorldChunks {
  private chunks = new Map<string, Chunk>();
  private painted = 0;
  constructor(
    private scene: Phaser.Scene,
    private salt: number,
    private showSand: boolean,
    private keepClear: readonly Vec2[],
  ) {
    const cleanup = () => {
      scene.events.off('shutdown', cleanup);
      scene.events.off('destroy', cleanup);
      for (const c of this.chunks.values()) this.release(c);
      this.chunks.clear();
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
  }

  /** Paint everything the camera needs now (startup, under the landing cut-scene). */
  fill(view: Phaser.Geom.Rectangle): void {
    for (const [cx, cy] of this.wanted(view)) this.paint(cx, cy);
  }

  /** Per frame: paint the nearest missing chunks within the budget, drop distant ones. */
  update(view: Phaser.Geom.Rectangle): void {
    const start = performance.now();
    for (const [cx, cy] of this.wanted(view)) {
      if (this.chunks.has(`${cx},${cy}`)) continue;
      this.paint(cx, cy);
      if (performance.now() - start > FRAME_BUDGET_MS) break;
    }
    for (const [key, c] of this.chunks) {
      const [cx, cy] = key.split(',').map(Number) as [number, number];
      const x = cx * CHUNK,
        y = cy * CHUNK;
      if (
        x + CHUNK < view.x - KEEP ||
        x > view.right + KEEP ||
        y + CHUNK < view.y - KEEP ||
        y > view.bottom + KEEP
      ) {
        this.release(c);
        this.chunks.delete(key);
      }
    }
    this.scene.registry.set('terrainChunks', this.chunks.size);
  }

  /** Chunk coordinates covering the view plus the prefetch ring, nearest to the centre first. */
  private wanted(view: Phaser.Geom.Rectangle): Array<[number, number]> {
    const lo = (v: number) => Math.floor(Math.max(WORLD_MIN, v - PREFETCH) / CHUNK);
    const hi = (v: number) => Math.floor((Math.min(WORLD_MAX, v + PREFETCH) - 1) / CHUNK);
    const out: Array<[number, number]> = [];
    for (let cy = lo(view.y); cy <= hi(view.bottom); cy++)
      for (let cx = lo(view.x); cx <= hi(view.right); cx++) out.push([cx, cy]);
    const mx = view.centerX / CHUNK,
      my = view.centerY / CHUNK;
    return out.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
  }

  private paint(cx: number, cy: number): void {
    const key = `${cx},${cy}`;
    if (this.chunks.has(key)) return;
    const pixels = paintRegion(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK, this.salt, this.showSand);
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK;
    canvas.height = CHUNK;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), CHUNK, CHUNK), 0, 0);
    decorateChunk(ctx, this.salt, cx, cy, this.keepClear);
    const textureKey = `chunk-${this.painted++}`;
    this.scene.textures.addCanvas(textureKey, canvas);
    const image = this.scene.add
      .image(cx * CHUNK, cy * CHUNK, textureKey)
      .setOrigin(0)
      .setDepth(DEPTH);
    this.chunks.set(key, { key: textureKey, image });
  }

  private release(c: Chunk): void {
    c.image.destroy();
    if (this.scene.textures.exists(c.key)) this.scene.textures.remove(c.key);
  }
}
