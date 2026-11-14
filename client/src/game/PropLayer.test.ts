import { expect, it } from 'vitest';
import { LANDER_POS, O2, PRESETS, SITES, WORLD_PX, deriveParams, generateSites } from '@rs/shared';
import { generateProps } from './PropLayer';
it('places the specified numbers of rocks, boulders and lander debris deterministically', () => {
  const sites = generateSites(deriveParams(PRESETS.balanced, 1));
  const a = generateProps(11, sites);
  expect(a).toEqual(generateProps(11, sites));
  expect(a).not.toEqual(generateProps(23, sites));
  expect(a.filter((p) => p.key.startsWith('rock_')).length).toBeGreaterThanOrEqual(40);
  expect(a.filter((p) => p.key.startsWith('rock_')).length).toBeLessThanOrEqual(60);
  expect(a.filter((p) => p.key.startsWith('boulder_')).length).toBeGreaterThanOrEqual(4);
  expect(a.filter((p) => p.key.startsWith('boulder_')).length).toBeLessThanOrEqual(6);
  expect(a.filter((p) => p.key === 'debris_chute')).toHaveLength(1);
});
it('keeps props inside the world and clear of every site and the airlock', () => {
  for (const landing of Object.values(SITES))
    for (let seed = 0; seed < 20; seed++) {
      const sites = generateSites(deriveParams({ ...PRESETS.balanced, site: landing.id }, seed));
      const props = generateProps(landing.terrainSalt, sites);
      for (const p of props) {
        expect(p.x).toBeGreaterThanOrEqual(24);
        expect(p.x).toBeLessThanOrEqual(WORLD_PX - 24);
        expect(p.y).toBeGreaterThanOrEqual(24);
        expect(p.y).toBeLessThanOrEqual(WORLD_PX - 24);
        expect(Math.hypot(p.x - LANDER_POS.x, p.y - LANDER_POS.y)).toBeGreaterThanOrEqual(
          O2.airlockRadius + 24,
        );
        for (const s of sites) expect(Math.hypot(p.x - s.x, p.y - s.y)).toBeGreaterThanOrEqual(24);
      }
      const debris = props.find((p) => p.key === 'debris_chute')!;
      expect(Math.hypot(debris.x - LANDER_POS.x, debris.y - LANDER_POS.y)).toBeLessThanOrEqual(101);
    }
});
