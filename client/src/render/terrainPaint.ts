/** Pure level-grid -> RGBA painter; no DOM, random calls, or trig per pixel. */
const COLORS = [
  [108, 42, 46],
  [138, 54, 42],
  [168, 74, 46],
  [198, 100, 58],
  [226, 134, 80],
] as const;
export function terrainPaint(
  levels: Uint8Array,
  width: number,
  height: number,
  sand?: Uint8Array,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        level = levels[i]!,
        color = sand?.[i] ? ([190, 139, 91] as const) : COLORS[level]!;
      let hash = Math.imul((x >> 1) ^ 0x45d9f3b, (y >> 1) ^ 0x119de1f3);
      hash ^= hash >>> 16;
      let shade = (hash & 31) - 15,
        blue = 0;
      if (sand?.[i]) shade += (x + y * 2) % 9 < 2 ? 16 : 3;
      if (level === 0 && (x + (y >> 2)) % 19 < 2) shade -= 9;
      if (level === 4 && (x * 3 + y * 5) % 73 < 2) shade -= 22;
      for (let k = 1; k <= 6; k++) {
        if (x >= k && y >= k && levels[(y - k) * width + x - k]! > level) {
          shade -= 26 - k * 3;
          blue = 5;
          break;
        }
      }
      if (x + 1 < width && y + 1 < height && level > levels[(y + 1) * width + x + 1]!) shade -= 28;
      if (x > 0 && y > 0 && level > levels[(y - 1) * width + x - 1]!) shade += 35;
      const p = i * 4;
      pixels[p] = color[0] + shade;
      pixels[p + 1] = color[1] + shade;
      pixels[p + 2] = color[2] + shade + blue;
      pixels[p + 3] = 255;
    }
  return pixels;
}
