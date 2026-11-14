import { expect, it } from 'vitest';
import { FIELD } from './style';
it('keeps every independently allocated particle pool within the shared field cap', () => {
  const allocations = [
    FIELD.juiceParticles,
    FIELD.hazardParticles,
    FIELD.sampleChips,
    FIELD.sampleSparks,
    FIELD.eventStorm,
    FIELD.eventDebris,
    FIELD.eventPuffs,
  ];
  expect(allocations.every((n) => n > 0 && Number.isInteger(n))).toBe(true);
  expect(allocations.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(FIELD.maxParticles);
});
