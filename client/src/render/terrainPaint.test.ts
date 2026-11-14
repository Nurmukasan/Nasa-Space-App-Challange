import { expect, it } from 'vitest';
import { terrainPaint } from './terrainPaint';
it('paints sand ripples only where the gameplay mask is set', () => {
  const levels = new Uint8Array([0, 0, 1, 2]);
  const original = terrainPaint(levels, 2, 2);
  const masked = terrainPaint(levels, 2, 2, new Uint8Array([1, 0, 0, 0]));
  expect(masked.slice(0, 3)).not.toEqual(original.slice(0, 3));
  expect(masked[3]).toBe(255);
  expect(masked.slice(4)).toEqual(original.slice(4));
  expect(terrainPaint(levels, 2, 2)).toEqual(original);
});
