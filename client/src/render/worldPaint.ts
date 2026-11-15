// Pure RGBA painter for any rectangle of the big world (docs/product-logic.md 7.1, 12).
// Same inputs → same pixels: chunks join without seams. No DOM, no randomness, no state.
import { BIOME, WORLD, biomeAt, levelAt, worldFor } from '@rs/shared';
import type { BiomeId, Tube } from '@rs/shared';

type RGB = readonly [number, number, number];

/** Five terrace levels per biome, low to high. Plains keep the v1 colours. */
export const PALETTES: Record<BiomeId, readonly RGB[]> = {
  plains: [
    [88, 46, 44],
    [120, 64, 50],
    [152, 88, 58],
    [182, 118, 76],
    [206, 146, 100],
  ],
  delta: [
    [74, 58, 50],
    [98, 80, 64],
    [124, 104, 80],
    [150, 128, 96],
    [174, 152, 114],
  ],
  dunes: [
    [150, 90, 50],
    [170, 106, 60],
    [190, 124, 72],
    [208, 142, 86],
    [224, 160, 102],
  ],
  ice: [
    [124, 122, 134],
    [156, 158, 172],
    [186, 192, 206],
    [212, 218, 230],
    [232, 238, 246],
  ],
  lava: [
    [46, 36, 40],
    [62, 48, 48],
    [80, 62, 58],
    [100, 78, 68],
    [122, 96, 82],
  ],
};

/** One flat colour per biome for maps (radar, wrist map, design cards). */
export const BIOME_TINT: Record<BiomeId, RGB> = {
  plains: [152, 88, 58],
  delta: [124, 104, 80],
  dunes: [194, 128, 74],
  ice: [190, 196, 210],
  lava: [62, 48, 48],
};

const BIOMES: BiomeId[] = ['plains', 'delta', 'dunes', 'ice', 'lava'];
/** Terrace shadows look up to 6 px up-left; edges look 1 px down-right. */
const PAD = 7;
/** Biome lookups on a coarse grid, jittered per pixel so borders dither. */
const CELL = 8;
/** Keeps pattern arithmetic positive in the negative half of the world. */
const OFFSET = 1 << 16;
/** Soft sand by biome: rusty, silty, dune-gold, frosted, black basaltic ash. */
const SAND: Record<BiomeId, RGB> = {
  plains: [190, 139, 91],
  delta: [168, 140, 104],
  dunes: [208, 142, 86],
  ice: [196, 200, 212],
  lava: [62, 56, 60],
};

function hash(x: number, y: number): number {
  let h = Math.imul(x ^ 0x45d9f3b, y ^ 0x119de1f3);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Paint `w`×`h` world pixels starting at (wx0, wy0). `showSand` marks soft sand (v2 scenarios),
 * so players see exactly where it slows them.
 */
export function paintRegion(
  wx0: number,
  wy0: number,
  w: number,
  h: number,
  salt: number,
  showSand: boolean,
): Uint8ClampedArray {
  const W = w + PAD + 1,
    H = h + PAD + 1;
  const levels = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) levels[y * W + x] = levelAt(wx0 - PAD + x, wy0 - PAD + y, salt);
  // Coarse biome grid with a one-cell margin for the jitter.
  const gx0 = Math.floor(wx0 / CELL) - 1,
    gy0 = Math.floor(wy0 / CELL) - 1;
  const GW = Math.ceil(w / CELL) + 3,
    GH = Math.ceil(h / CELL) + 3;
  const grid = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++)
      grid[y * GW + x] = BIOMES.indexOf(
        biomeAt((gx0 + x) * CELL + CELL / 2, (gy0 + y) * CELL + CELL / 2, salt),
      );
  const caves = caveSegments(wx0, wy0, w, h, salt);
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx = wx0 + x,
        gy = wy0 + y;
      const px = gx + OFFSET,
        py = gy + OFFSET;
      const li = (y + PAD) * W + x + PAD;
      const level = levels[li]!;
      const n = hash(px >> 1, py >> 1);
      const jx = ((n >>> 3) & 7) - 3,
        jy = ((n >>> 6) & 7) - 3;
      const cx = Math.floor((gx + jx) / CELL) - gx0,
        cy = Math.floor((gy + jy) / CELL) - gy0;
      const biome = BIOMES[grid[cy * GW + cx]!]!;
      const p = (y * w + x) * 4;
      const cell = caves.length ? caveCell(caves, gx, gy) : 0;
      if (cell !== 0 && cell !== 4) {
        paintCave(pixels, p, cell, n, px, py);
        continue;
      }
      let color: RGB = PALETTES[biome][level]!;
      // Coarse 32 px blocks of slightly different dust, plus fine grain.
      let block = Math.imul((px >> 5) ^ 0x2c1b3c6d, (py >> 5) ^ 0x297a2d39);
      block ^= block >>> 15;
      let shade = (n & 15) - 7 + ((block & 7) - 3);
      let blue = 0;
      let sand = false;
      if (showSand) {
        if (biome === 'dunes') sand = level < BIOME.dunesHardLevel;
        else if (level === 0)
          sand = (Math.sin(gx / 73 + salt) + Math.cos(gy / 91 - salt)) / 2 > 0.35;
      }
      switch (biome) {
        case 'plains':
          if (level === 0 && (px + (py >> 2)) % 19 < 2) shade -= 9;
          if (level === 4 && (px * 3 + py * 5) % 73 < 2) shade -= 22;
          break;
        case 'delta': {
          // Layered sediments and dry, meandering channels on the low beds.
          if ((py + level * 7) % 6 < 2) shade += 6;
          const channel = Math.abs(Math.sin(gx / 90 + Math.sin(gy / 60) * 1.5 + salt));
          if (level <= 1 && channel < 0.05) {
            shade -= 26;
            blue = 4;
          }
          break;
        }
        case 'dunes': {
          // Long wind ripples with a lit crest and a shaded trough.
          const ripple = (px * 2 + py * 3 + Math.round(40 * Math.sin(gy / 50))) % 23;
          if (ripple < 2) shade += 14;
          else if (ripple < 4) shade -= 10;
          break;
        }
        case 'ice': {
          // Polar layered deposits: swirling pale bands, blue cracks.
          const band = Math.floor((px * 0.3 + py * 0.7 + 20 * Math.sin(gx / 80)) / 9) % 2;
          shade += band ? 6 : -4;
          blue = 10;
          if ((px * 7 + py * 3) % 97 < 1) shade -= 26;
          break;
        }
        case 'lava': {
          // Ropy pahoehoe ridges and rusty oxidised patches.
          if ((px + Math.round(6 * Math.sin(py / 7))) % 11 < 1) shade -= 10;
          if ((block & 31) < 3) color = [color[0] + 22, color[1] + 6, color[2]];
          break;
        }
      }
      if (sand) {
        color = SAND[biome];
        shade += (px + py * 2) % 9 < 2 ? 16 : 3;
      }
      // Terrace shadows (softer on bright ice) and lit / shaded edges.
      const soft = biome === 'ice' ? 0.6 : 1;
      for (let k = 1; k <= 6; k++) {
        if (levels[li - k * W - k]! > level) {
          shade -= (17 - k * 2) * soft;
          blue += 5;
          break;
        }
      }
      if (level > levels[li + W + 1]!) shade -= 18 * soft;
      if (level > levels[li - W - 1]!) shade += 22 * soft;
      if (cell === 4) shade -= 34;
      pixels[p] = color[0] + shade;
      pixels[p + 1] = color[1] + shade;
      pixels[p + 2] = color[2] + shade + blue;
      pixels[p + 3] = 255;
    }
  return pixels;
}

interface CaveSegs {
  tube: Tube;
  /** Centreline segments near the region, as [ax, ay, bx, by] quadruples. */
  segs: number[];
}

/** Only the tube segments that can touch this region (most chunks have none). */
function caveSegments(wx0: number, wy0: number, w: number, h: number, salt: number): CaveSegs[] {
  const out: CaveSegs[] = [];
  for (const tube of worldFor(salt).tubes) {
    if (tube.x1 < wx0 || tube.x0 > wx0 + w || tube.y1 < wy0 || tube.y0 > wy0 + h) continue;
    const reach = tube.halfWidth + WORLD.rimPx + 2;
    const segs: number[] = [];
    for (let i = 0; i + 1 < tube.points.length; i++) {
      const a = tube.points[i]!,
        b = tube.points[i + 1]!;
      if (
        Math.max(a.x, b.x) + reach < wx0 ||
        Math.min(a.x, b.x) - reach > wx0 + w ||
        Math.max(a.y, b.y) + reach < wy0 ||
        Math.min(a.y, b.y) - reach > wy0 + h
      )
        continue;
      segs.push(a.x, a.y, b.x, b.y);
    }
    if (segs.length) out.push({ tube, segs });
  }
  return out;
}

/** Position across the rim (0 inner edge … 1 outer edge), set by caveCell for shading. */
let rimT = 0;
/** Width of the drop shadow the rock rim casts outside, px. */
const RIM_SHADOW = 3;

/**
 * caveCellAt for the pre-filtered segments: 0 open · 1 floor · 2 rim · 3 skylight, plus
 * 4 for the open ground in the rim's shadow (painted, not a rule).
 */
function caveCell(caves: CaveSegs[], x: number, y: number): 0 | 1 | 2 | 3 | 4 {
  for (const { tube, segs } of caves) {
    let d = Infinity;
    for (let i = 0; i < segs.length; i += 4) {
      const ax = segs[i]!,
        ay = segs[i + 1]!,
        dx = segs[i + 2]! - ax,
        dy = segs[i + 3]! - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - (ax + t * dx),
        ey = y - (ay + t * dy);
      const e = ex * ex + ey * ey;
      if (e < d) d = e;
    }
    d = Math.sqrt(d);
    if (d < tube.halfWidth) return 1;
    const outer = tube.halfWidth + WORLD.rimPx;
    const open = tube.entrances.some((p) => Math.hypot(x - p.x, y - p.y) < WORLD.entranceR);
    if (d >= outer) {
      if (d < outer + RIM_SHADOW && !open) return 4;
      continue;
    }
    rimT = (d - tube.halfWidth) / WORLD.rimPx;
    return open ? 3 : 2;
  }
  return 0;
}

/** Lava tube floor (dark, rubble), rock rim (lit top-left) and skylight debris. */
function paintCave(
  pixels: Uint8ClampedArray,
  p: number,
  cell: 1 | 2 | 3,
  n: number,
  px: number,
  py: number,
): void {
  let r: number, g: number, b: number;
  if (cell === 1) {
    // The floor under the roof: near black, cold, with scattered rubble.
    const grain = (n & 7) - 3;
    const rubble = (px * 13 + py * 7) % 41 < 1 ? 18 : 0;
    r = 14 + grain + rubble;
    g = 11 + grain + rubble;
    b = 20 + grain + rubble;
  } else if (cell === 2) {
    // The rock rim as a raised wall: dark inner lip, a lit crest, a shaded outer face.
    const grain = (n & 15) - 7;
    const tone = rimT < 0.25 ? -38 : rimT < 0.55 ? 42 : rimT < 0.8 ? 12 : -14;
    const facet = (px * 3 + py * 5) % 11 < 2 ? 10 : 0;
    r = 118 + tone + grain + facet;
    g = 98 + tone + grain + facet;
    b = 92 + tone + grain + facet;
  } else {
    // Skylight: sunlit collapse rubble, the way in.
    const grain = (n & 15) - 7;
    const stone = (px * 7 + py * 11) % 13 < 3 ? -26 : 0;
    r = 176 + grain + stone;
    g = 140 + grain + stone;
    b = 108 + grain + stone;
  }
  pixels[p] = r;
  pixels[p + 1] = g;
  pixels[p + 2] = b;
  pixels[p + 3] = 255;
}
