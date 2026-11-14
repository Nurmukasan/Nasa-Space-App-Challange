import { expect, it } from 'vitest';
import { WORLD_PX } from '@rs/shared';
import { miniMapPoint } from './miniMap';
it('converts clicks using the rendered rectangle, including CSS-resized maps', () => {
  expect(miniMapPoint(64, 64, 128, 128)).toEqual({ x: WORLD_PX / 2, y: WORLD_PX / 2 });
  expect(miniMapPoint(64, 32, 256, 128)).toEqual({ x: WORLD_PX / 4, y: WORLD_PX / 4 });
  expect(miniMapPoint(-10, 200, 128, 128)).toEqual({ x: 0, y: WORLD_PX });
});
