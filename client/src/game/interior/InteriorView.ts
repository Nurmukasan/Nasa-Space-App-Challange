// Full-resolution view of the lander interior, drawn as DOM above the game canvas.
// The 480x270 game canvas would shrink the 64-px tiles to 16 px and lose their detail, so the
// map (1920x1088, base.tmj) is painted on canvases of its own size and laid over the game:
// a static one for floor and walls, a dynamic one for props, doors and the astronaut.
import { VIEW_W } from '@rs/shared';
import { ATLAS, COLS, FLOOR, MAP_H, MAP_W, ROWS, TILE, TILESET, WALLS } from './baseMap';

const RECT_REFRESH_MS = 400;
const BASE_URL = `${import.meta.env.BASE_URL}assets/interior/`;
/** Map pixels per view pixel (the view is 480 px wide). */
export const MAP_PER_VIEW = MAP_W / VIEW_W;

const img = (name: string): HTMLImageElement => {
  const el = new Image();
  el.src = `${BASE_URL}${name}`;
  return el;
};
/** Start downloading at game start so the base is ready when the astronaut steps in. */
export const pictures = { atlas: img('atlas.webp'), tiles: img('tiles.webp') };
export const picturesReady = (): boolean => pictures.atlas.complete && pictures.tiles.complete;

const css = (el: HTMLElement, style: Partial<CSSStyleDeclaration>): void => {
  Object.assign(el.style, style);
};

export interface Label {
  text: string;
  /** Map px for world labels, view px (0..480, 0..270) for screen labels. */
  x: number;
  y: number;
}

/** Draw atlas frame `name` with its top-left at (x, y), optionally only a horizontal slice. */
export function drawSprite(
  g: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  slice?: { from: number; width: number },
): void {
  const f = ATLAS[name];
  if (!f) return;
  const sx = slice ? slice.from : 0,
    sw = slice ? slice.width : f.w;
  if (sw <= 0) return;
  g.drawImage(pictures.atlas, f.x + sx, f.y, sw, f.h, x + sx, y, sw, f.h);
}

export class InteriorView {
  readonly ctx: CanvasRenderingContext2D;
  private root = document.createElement('div');
  private room = document.createElement('div');
  private base = document.createElement('canvas');
  private canvas = document.createElement('canvas');
  private alarm = document.createElement('div');
  private labels = new Map<string, HTMLDivElement>();
  private k = 1;
  private rectAt = -Infinity;
  private painted = false;

  constructor(private gameCanvas: HTMLCanvasElement) {
    css(this.root, {
      position: 'absolute',
      left: '0',
      top: '0',
      pointerEvents: 'none',
      zIndex: '1',
    });
    css(this.room, { position: 'absolute', left: '0', top: '0' });
    for (const c of [this.base, this.canvas]) {
      c.width = MAP_W;
      c.height = MAP_H;
      css(c, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    }
    css(this.alarm, { position: 'absolute', inset: '0', background: '#ff2020', opacity: '0' });
    this.room.append(this.base, this.canvas);
    this.root.append(this.room, this.alarm);
    gameCanvas.parentElement?.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Floor and wall tile layers, painted once when the tile image has loaded. */
  paintBase(): void {
    if (this.painted || !pictures.tiles.complete) return;
    const g = this.base.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    for (const data of [FLOOR, WALLS])
      for (let i = 0; i < COLS * ROWS; i++) {
        const gid = data[i]!;
        if (!gid) continue;
        const t = gid - TILESET.firstgid;
        g.drawImage(
          pictures.tiles,
          (t % TILESET.columns) * TILE,
          Math.floor(t / TILESET.columns) * TILE,
          TILE,
          TILE,
          (i % COLS) * TILE,
          Math.floor(i / COLS) * TILE,
          TILE,
          TILE,
        );
      }
    this.painted = true;
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
      width: `${(MAP_W / MAP_PER_VIEW) * this.k}px`,
      height: `${(MAP_H / MAP_PER_VIEW) * this.k}px`,
    });
  }

  setAlarm(opacity: number): void {
    this.alarm.style.opacity = String(opacity);
  }

  /** Sharp DOM text; `anchor` is the CSS translate that sets which point sits on (x, y). */
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
    const s = world ? this.k / MAP_PER_VIEW : this.k;
    el.style.fontSize = `${Math.max(10, 3.4 * this.k)}px`;
    el.style.transform = `translate(${(l.x * s).toFixed(1)}px, ${(l.y * s).toFixed(1)}px) ${anchor}`;
  }

  destroy(): void {
    this.root.remove();
  }
}
