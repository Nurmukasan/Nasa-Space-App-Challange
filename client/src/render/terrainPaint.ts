/** Pure level-grid -> RGBA painter; no DOM, random calls, or trig per pixel. */
const COLORS = [
  [88, 46, 44],
  [120, 64, 50],
  [152, 88, 58],
  [182, 118, 76],
  [206, 146, 100],
] as const;
export function terrainPaint(levels: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        level = levels[i]!,
        color = COLORS[level]!;
      let hash = Math.imul((x >> 1) ^ 0x45d9f3b, (y >> 1) ^ 0x119de1f3);
      hash ^= hash >>> 16;
      // Coarse 32px blocks of slightly different dust, plus fine grain.
      let block = Math.imul((x >> 5) ^ 0x2c1b3c6d, (y >> 5) ^ 0x297a2d39);
      block ^= block >>> 15;
      let shade = (hash & 15) - 7 + (((block & 7) - 3) >> 0),
        blue = 0;
      if (level === 0 && (x + (y >> 2)) % 19 < 2) shade -= 9;
      if (level === 4 && (x * 3 + y * 5) % 73 < 2) shade -= 22;
      for (let k = 1; k <= 6; k++) {
        if (x >= k && y >= k && levels[(y - k) * width + x - k]! > level) {
          shade -= 17 - k * 2;
          blue = 5;
          break;
        }
      }
      if (x + 1 < width && y + 1 < height && level > levels[(y + 1) * width + x + 1]!) shade -= 18;
      if (x > 0 && y > 0 && level > levels[(y - 1) * width + x - 1]!) shade += 22;
      const p = i * 4;
      pixels[p] = color[0] + shade;
      pixels[p + 1] = color[1] + shade;
      pixels[p + 2] = color[2] + shade + blue;
      pixels[p + 3] = 255;
    }
  return pixels;
}
