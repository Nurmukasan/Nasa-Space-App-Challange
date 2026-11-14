import type Phaser from 'phaser';
import { VIEW_W } from '@rs/shared';
import { FIELD } from './style';

/**
 * Text drawn as real DOM above the canvas. The game canvas is 480x270 scaled up,
 * so Phaser text turns to mush; DOM text stays sharp at any window size.
 */
export class WorldLabels {
  private root = document.createElement('div');
  private items = new Map<string, HTMLDivElement>();
  private used = new Set<string>();
  private floats: { el: HTMLDivElement; x: number; y: number; until: number }[] = [];

  constructor(private scene: Phaser.Scene) {
    this.root.className = 'world-labels';
    scene.game.canvas.parentElement?.appendChild(this.root);
    scene.events.once('shutdown', () => this.root.remove());
  }

  /** World position label; pass screen=true for view-space coordinates (0..VIEW_W). */
  set(key: string, text: string, x: number, y: number, kind: string, screen = false): void {
    let el = this.items.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = `wl ${kind}`;
      this.root.appendChild(el);
      this.items.set(key, el);
    }
    if (el.textContent !== text) el.textContent = text;
    el.dataset.x = String(x);
    el.dataset.y = String(y);
    el.dataset.screen = screen ? '1' : '';
    el.style.display = '';
    this.used.add(key);
  }

  float(x: number, y: number, text: string, color: string): void {
    const el = document.createElement('div');
    el.className = 'wl-float';
    const inner = document.createElement('span');
    inner.textContent = text;
    inner.style.color = color;
    el.appendChild(inner);
    this.root.appendChild(el);
    this.floats.push({ el, x, y, until: performance.now() + FIELD.fxDurationMs });
  }

  /** Call once per frame after all set() calls. */
  flush(): void {
    const cam = this.scene.cameras.main;
    const canvas = this.scene.game.canvas.getBoundingClientRect();
    const origin = this.root.getBoundingClientRect();
    const k = canvas.width / VIEW_W;
    const place = (el: HTMLElement, wx: number, wy: number, screen: boolean) => {
      const sx = screen ? wx : wx - cam.scrollX,
        sy = screen ? wy : wy - cam.scrollY;
      const x = canvas.left - origin.left + sx * k,
        y = canvas.top - origin.top + sy * k;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    };
    for (const [key, el] of this.items) {
      if (!this.used.has(key)) {
        el.style.display = 'none';
        continue;
      }
      place(el, Number(el.dataset.x), Number(el.dataset.y), !!el.dataset.screen);
    }
    this.used.clear();
    const now = performance.now();
    this.floats = this.floats.filter((f) => {
      if (now >= f.until) {
        f.el.remove();
        return false;
      }
      place(f.el, f.x, f.y, false);
      return true;
    });
  }

  /** Drop labels that no longer exist (an astronaut who left). */
  forget(key: string): void {
    this.items.get(key)?.remove();
    this.items.delete(key);
  }
}

const cache = new WeakMap<Phaser.Scene, WorldLabels>();
export function worldLabels(scene: Phaser.Scene): WorldLabels {
  let labels = cache.get(scene);
  if (!labels) {
    labels = new WorldLabels(scene);
    cache.set(scene, labels);
  }
  return labels;
}
