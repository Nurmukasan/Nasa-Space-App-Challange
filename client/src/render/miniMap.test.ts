import { expect, it } from 'vitest';
import { LANDER_POS, WORLD_MAX, WORLD_MIN, WORLD_PX } from '@rs/shared';
import { miniMapPoint } from './miniMap';
it('converts clicks using the rendered rectangle, including CSS-resized maps', () => {
  // The big world is centred on the lander (v2.1): the whole-world view maps its centre there.
  expect(miniMapPoint(64, 64, 128, 128)).toEqual({ x: LANDER_POS.x, y: LANDER_POS.y });
  expect(miniMapPoint(64, 32, 256, 128)).toEqual({
    x: WORLD_MIN + WORLD_PX / 4,
    y: WORLD_MIN + WORLD_PX / 4,
  });
  expect(miniMapPoint(-10, 200, 128, 128)).toEqual({ x: WORLD_MIN, y: WORLD_MAX });
});
it('maps clicks inside a window of the world', () => {
  const view = { x0: 100, y0: -400, span: 2048 };
  expect(miniMapPoint(64, 64, 128, 128, view)).toEqual({ x: 100 + 1024, y: -400 + 1024 });
});
