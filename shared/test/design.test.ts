import { describe, expect, it } from 'vitest';
import { PRESETS, checkDesign, deriveParams, setDesignField, toggleModule } from '../src';

describe('design', () => {
  it('all presets are launchable', () => {
    for (const d of Object.values(PRESETS)) expect(checkDesign(d).ok).toBe(true);
  });

  it('flags over budget and over mass as errors', () => {
    const d = {
      ...PRESETS.science,
      vehicle: 'medium' as const,
      modules: [...PRESETS.science.modules, 'moxie_l' as const],
    };
    const check = checkDesign(d);
    expect(check.ok).toBe(false);
    expect(check.issues.map((i) => i.code)).toContain('over_mass');
  });

  it('requires power and oxygen production', () => {
    const d = { ...PRESETS.balanced, modules: [] };
    const codes = checkDesign(d).issues.map((i) => i.code);
    expect(codes).toContain('no_power');
    expect(codes).toContain('no_moxie');
  });

  it('data is a resource: more instruments need a better link', () => {
    const heavy = { ...PRESETS.budget, vehicle: 'heavy' as const };
    const lean = checkDesign(heavy);
    expect(lean.totals.dataGen).toBeLessThanOrEqual(lean.totals.dataCap);
    let d = toggleModule(heavy, 'seismo_net', true)!;
    d = toggleModule(d, 'gpr', true)!;
    d = toggleModule(d, 'weather', true)!;
    const loaded = checkDesign(d);
    expect(loaded.issues.map((i) => i.code)).toContain('data_bottleneck');
    expect(deriveParams(d, 1).dataFactor).toBeLessThan(1);
    // Two different fixes for the same problem: a bigger antenna or a relay orbiter.
    expect(deriveParams(toggleModule(d, 'antenna_hg', true)!, 1).dataFactor).toBe(1);
    expect(deriveParams(setDesignField(d, 'relay', 'low_orbit')!, 1).dataFactor).toBe(1);
  });

  it('checks that the launch vehicle can deliver the chosen relay orbit', () => {
    const d = { ...PRESETS.budget, relay: 'areostationary' as const };
    expect(checkDesign(d).issues.map((i) => i.code)).toContain('vehicle_orbit');
    const onHeavy = checkDesign({ ...d, vehicle: 'heavy' as const });
    expect(onHeavy.issues.map((i) => i.code)).not.toContain('vehicle_orbit');
  });

  it('rejects unknown ids', () => {
    expect(setDesignField(PRESETS.balanced, 'site', 'pluto')).toBeNull();
    expect(setDesignField(PRESETS.balanced, '__proto__', 'x')).toBeNull();
    expect(toggleModule(PRESETS.balanced, 'laser', true)).toBeNull();
  });

  it('modules change sim params', () => {
    const base = deriveParams(PRESETS.budget, 1);
    const drill = deriveParams(toggleModule(PRESETS.budget, 'drill', true)!, 1);
    expect(drill.maxDepth).toBeGreaterThan(base.maxDepth);
    expect(drill.digRate).toBeGreaterThan(base.digRate);
    expect(drill.walkSpeed).toBeLessThan(base.walkSpeed);
    const net = deriveParams(toggleModule(PRESETS.budget, 'seismo_net', true)!, 1);
    expect(net.stations).toBe(3);
  });
});
