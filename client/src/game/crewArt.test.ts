import { describe, expect, it } from 'vitest';
import { CREW_CLASS_IDS } from '@rs/shared';
import { CREW_FEET_Y, CREW_FRAME, CREW_FRAMES, crewSheet } from './crewArt';

/** Opaque pixels of one frame as a string, to compare frames. */
function frame(data: Uint8ClampedArray, width: number, i: number): string {
  let out = '';
  for (let y = 0; y < CREW_FRAME; y++)
    for (let x = 0; x < CREW_FRAME; x++) {
      const o = (y * width + i * CREW_FRAME + x) * 4;
      out += data[o + 3] ? `${data[o]},${data[o + 1]},${data[o + 2]};` : '.';
    }
  return out;
}
const lowestRow = (data: Uint8ClampedArray, width: number, i: number): number => {
  for (let y = CREW_FRAME - 1; y >= 0; y--)
    for (let x = 0; x < CREW_FRAME; x++)
      if (data[(y * width + i * CREW_FRAME + x) * 4 + 3]) return y;
  return -1;
};

describe('crew sprites drawn in code', () => {
  it('draws every 24x24 frame per class, all different from each other', () => {
    for (const id of CREW_CLASS_IDS) {
      const s = crewSheet(id);
      expect([s.width, s.height]).toEqual([CREW_FRAME * CREW_FRAMES, CREW_FRAME]);
      const frames = Array.from({ length: CREW_FRAMES }, (_, i) => frame(s.data, s.width, i));
      for (const f of frames) expect(f.replaceAll('.', '').length).toBeGreaterThan(100);
      expect(new Set(frames).size).toBe(CREW_FRAMES);
    }
  });

  it('keeps the feet on the ground line in every standing and walking frame', () => {
    const s = crewSheet('scout');
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7])
      expect(lowestRow(s.data, s.width, i)).toBe(CREW_FEET_Y + 1);
  });

  it('gives each class its own look', () => {
    const looks = CREW_CLASS_IDS.map((id) =>
      frame(crewSheet(id).data, CREW_FRAME * CREW_FRAMES, 0),
    );
    expect(new Set(looks).size).toBe(CREW_CLASS_IDS.length);
  });
});
