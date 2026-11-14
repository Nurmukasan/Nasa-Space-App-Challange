import type Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '@rs/shared';
import { FIELD } from './style';

const RECT_REFRESH_MS = 400;
const NOTE_MARGIN_X = 70;
const NOTE_MARGIN_Y = 50;

/**
 * Text drawn as real DOM above the canvas. The game canvas is 480x270 scaled up,
 * so Phaser text turns to mush; DOM text stays sharp at any window size.
 */
export class WorldLabels {
  private root = document.createElement('div');
  private items = new Map<string, HTMLDivElement>();
  private used = new Set<string>();
  private rects: { canvas: DOMRect; origin: DOMRect } | null = null;
  private rectAt = 0;
  private notes: { el: HTMLDivElement; x: number; y: number; until: number }[] = [];
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

  /** A titled callout pinned to a world position; sticks to the view edge when off screen. */
  note(x: number, y: number, title: string, detail: string, color: string, ms: number): void {
    const el = document.createElement('div');
    el.className = 'wl-note';
    el.style.setProperty('--c', color);
    el.style.setProperty('--ms', `${ms}ms`);
    const head = document.createElement('b');
    head.textContent = title;
    const body = document.createElement('span');
    body.textContent = detail;
    el.append(head, body);
    this.root.appendChild(el);
    this.notes.push({ el, x, y, until: performance.now() + ms });
  }

  /** Call once per frame after all set() calls. */
  flush(): void {
    const cam = this.scene.cameras.main;
    // Layout reads are costly; the canvas only moves on resize, so refresh a few times a second.
    const stamp = performance.now();
    if (!this.rects || stamp - this.rectAt > RECT_REFRESH_MS) {
      this.rects = {
        canvas: this.scene.game.canvas.getBoundingClientRect(),
        origin: this.root.getBoundingClientRect(),
      };
      this.rectAt = stamp;
    }
    const { canvas, origin } = this.rects;
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
    this.notes = this.notes.filter((n) => {
      if (stamp >= n.until) {
        n.el.remove();
        return false;
      }
      const sx = n.x - cam.scrollX,
        sy = n.y - cam.scrollY;
      const cx = Math.min(VIEW_W - NOTE_MARGIN_X, Math.max(NOTE_MARGIN_X, sx)),
        cy = Math.min(VIEW_H - NOTE_MARGIN_Y, Math.max(NOTE_MARGIN_Y, sy));
      n.el.classList.toggle('off-screen', cx !== sx || cy !== sy);
      place(n.el, cx, cy, true);
      return true;
    });
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
