// Full-resolution view of the lander interior, drawn as DOM above the game canvas.
// The 480x270 game canvas would shrink the team's picture and lose its detail, so the picture is
// shown as it is (assets/interior/base.webp, 1830x985) and everything on it (doors, astronaut,
// ARIA's face, core glow) is painted on a canvas of the same size. Game logic stays in 480-px
// picture units (layout.ts); this file only scales by HD.
import { VIEW_H, VIEW_W } from '@rs/shared';
import { IMG_H, IMG_W } from './layout';

/** Picture pixels per layout pixel. */
export const HD = 1830 / IMG_W;
/** The picture starts this many layout px below the top of the view (room for the header). */
export const TOP = 6;
const RECT_REFRESH_MS = 400;
const BASE_URL = `${import.meta.env.BASE_URL}assets/interior/`;

const img = (name: string): HTMLImageElement => {
  const el = new Image();
  el.src = `${BASE_URL}${name}`;
  return el;
};
/** Start downloading early so the room is ready when the astronaut steps in. */
export const pictures = { base: img('base.webp'), doors: img('doors.webp') };

const css = (el: HTMLElement, style: Partial<CSSStyleDeclaration>): void => {
  Object.assign(el.style, style);
};

export interface Label {
  text: string;
  /** Layout px; for screen labels, view px (0..480, 0..270). */
  x: number;
  y: number;
}

export class InteriorView {
  readonly ctx: CanvasRenderingContext2D;
  private root = document.createElement('div');
  private room = document.createElement('div');
  private canvas = document.createElement('canvas');
  private alarm = document.createElement('div');
  private labels = new Map<string, HTMLDivElement>();
  private k = 1;
  private rectAt = -Infinity;

  constructor(private gameCanvas: HTMLCanvasElement) {
    css(this.root, {
      position: 'absolute',
      left: '0',
      top: '0',
      pointerEvents: 'none',
      zIndex: '1',
    });
    css(this.room, { position: 'absolute', left: '0' });
    const base = pictures.base.cloneNode() as HTMLImageElement;
    css(base, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    this.canvas.width = Math.round(IMG_W * HD);
    this.canvas.height = Math.round(IMG_H * HD);
    css(this.canvas, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    css(this.alarm, { position: 'absolute', inset: '0', background: '#ff2020', opacity: '0' });
    this.room.append(base, this.canvas);
    this.root.append(this.room, this.alarm);
    gameCanvas.parentElement?.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Keep the layer exactly over the game canvas (it moves only on window resize). */
  sync(now: number): void {
    if (now - this.rectAt < RECT_REFRESH_MS) return;
    this.rectAt = now;
    const c = this.gameCanvas.getBoundingClientRect();
    const p = this.root.parentElement!.getBoundingClientRect();
    this.k = c.width / VIEW_W;
    css(this.root, {
      left: `${c.left - p.left}px`,
      top: `${c.top - p.top}px`,
      width: `${c.width}px`,
      height: `${c.height}px`,
    });
    css(this.room, {
      top: `${TOP * this.k}px`,
      width: `${IMG_W * this.k}px`,
      height: `${IMG_H * this.k}px`,
    });
  }

  setAlarm(opacity: number): void {
    this.alarm.style.opacity = String(opacity);
  }

  /**
   * Sharp DOM text. `world` labels use layout px (they move with the room), others view px.
   * `anchor` is the CSS translate that sets which point of the box sits on (x, y).
   */
  label(
    key: string,
    l: Label | null,
    style: Partial<CSSStyleDeclaration>,
    world: boolean,
    anchor: string,
  ): void {
    let el = this.labels.get(key);
    if (!el) {
      el = document.createElement('div');
      css(el, {
        position: 'absolute',
        left: '0',
        top: '0',
        whiteSpace: 'nowrap',
        fontFamily: 'Silkscreen, monospace',
        padding: '0.25em 0.5em',
        ...style,
      });
      this.root.appendChild(el);
      this.labels.set(key, el);
    }
    el.style.display = l ? '' : 'none';
    if (!l) return;
    if (el.textContent !== l.text) el.textContent = l.text;
    const x = l.x * this.k,
      y = (world ? l.y + TOP : l.y) * this.k;
    el.style.fontSize = `${Math.max(10, 3.4 * this.k)}px`;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${anchor}`;
  }

  destroy(): void {
    this.root.remove();
  }
}

/** Layout size of the whole view, for screen-anchored labels. */
export const VIEW = { w: VIEW_W, h: VIEW_H };
