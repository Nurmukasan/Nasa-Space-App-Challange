import { expect, it } from 'vitest';
import { DISCOVERY, PRESETS, deriveParams, generateSites } from '../src';
import type { SampleSite } from '../src';
import { discoverySystem } from '../src/sim/discovery';
import { createSim } from '../src/sim/sim';

function mission(gpr = false) {
  const design = { ...PRESETS.balanced, modules: [...PRESETS.balanced.modules] };
  design.modules = design.modules.filter((m) => m !== 'gpr');
  if (gpr) design.modules.push('gpr');
  const sim = createSim(deriveParams(design, 27, 'signal'), ['a', 'b']);
  sim.pub.t = 0;
  return sim;
}

it('keeps all free and training sites public, without anomalies or scanner readings', () => {
  for (const scenario of ['free', 'training'] as const) {
    const params = deriveParams(PRESETS.balanced, 27, scenario);
    const sim = createSim(params, ['a']);
    sim.pub.t = 0;
    discoverySystem(sim, 1);
    expect(sim.pub.sites).toEqual(generateSites(params));
    expect(sim.hidden.hiddenSites).toEqual([]);
    expect(sim.pub.anomalies).toEqual([]);
    expect(sim.pub.astronauts[0]!.scan).toBeNull();
  }
});

it('exposes only the first signal ring and deterministic fuzzed orbital hints', () => {
  const sim = mission();
  expect(sim.pub.sites).toHaveLength(3);
  expect(sim.pub.sites.every((s) => s.richness === 1 && s.known)).toBe(true);
  expect(sim.hidden.hiddenSites).toHaveLength(5);
  expect(sim.pub.anomalies).toHaveLength(5);
  expect(sim.pub.anomalies).toEqual(mission().pub.anomalies);
  for (const anomaly of sim.pub.anomalies) {
    const site = sim.hidden.hiddenSites.find((s) => s.id === anomaly.id)!;
    const offset = Math.hypot(anomaly.x - site.x, anomaly.y - site.y);
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThanOrEqual(DISCOVERY.anomalyFuzz);
    expect(anomaly.r).toBe(DISCOVERY.anomalyR);
    expect(anomaly.kind).toBeNull();
    expect(anomaly.richness).toBeNull();
    expect(site.known).toBe(false);
    expect(JSON.stringify(sim.pub.sites)).not.toContain(`"id":"${site.id}"`);
  }
});

it('shows anomaly kind/richness with GPR and extends scanner range', () => {
  for (const gpr of [false, true]) {
    const sim = mission(gpr);
    const site = sim.hidden.hiddenSites[0]!;
    sim.hidden.hiddenSites = [site];
    for (const hint of sim.pub.anomalies) {
      const original = generateSites(sim.params).find((s) => s.id === hint.id)!;
      expect(hint.kind).toBe(gpr ? original.kind : null);
      expect(hint.richness).toBe(gpr ? original.richness : null);
    }
    Object.assign(sim.pub.astronauts[0]!, { x: site.x - 140, y: site.y });
    discoverySystem(sim, 0);
    if (gpr) expect(sim.pub.astronauts[0]!.scan).toEqual({ dist: 140, bearing: 0 });
    else expect(sim.pub.astronauts[0]!.scan).toBeNull();
    sim.pub.astronauts[0]!.x = site.x - sim.params.scanRange - 1;
    discoverySystem(sim, 0);
    expect(sim.pub.astronauts[0]!.scan).toBeNull();
  }
});

it('tracks the nearest hidden site and reveals it exactly once for two nearby crew', () => {
  const sim = mission();
  const site = sim.hidden.hiddenSites[0]!;
  sim.hidden.hiddenSites = [site];
  for (const a of sim.pub.astronauts) Object.assign(a, { x: site.x - 60, y: site.y });
  discoverySystem(sim, 0);
  expect(sim.pub.astronauts[0]!.scan).toEqual({ dist: 60, bearing: 0 });
  sim.pub.astronauts[0]!.x = site.x - 30;
  discoverySystem(sim, 0);
  expect(sim.pub.astronauts[0]!.scan!.dist).toBe(30);
  for (const a of sim.pub.astronauts) a.x = site.x - DISCOVERY.revealDist + 1;
  discoverySystem(sim, 0);
  discoverySystem(sim, 0);
  expect(sim.pub.sites.filter((s) => s.id === site.id)).toHaveLength(1);
  expect(site.known).toBe(true);
  expect(sim.hidden.hiddenSites).toEqual([]);
  expect(sim.pub.anomalies.some((a) => a.id === site.id)).toBe(false);
  expect(sim.pub.fx.filter((fx) => fx.type === 'discovery')).toHaveLength(1);
  expect(sim.pub.log.filter((entry) => entry.key === 'log.discovery')).toHaveLength(1);
  expect(sim.hidden.stats.discoveries).toBe(1);
  expect(sim.hidden.stats.scienceRaw).toBe(DISCOVERY.science);
  expect(sim.hidden.stats.crewStats.map((a) => a.discoveries)).toEqual([1, 0]);
  expect(sim.hidden.stats.crewStats[0]!.science).toBe(DISCOVERY.science);
  expect(sim.pub.astronauts.every((a) => a.scan === null)).toBe(true);
});

it('keeps the source out of the scanner until located, then discovers it once', () => {
  const sim = mission();
  const source: SampleSite = {
    ...sim.hidden.hiddenSites[0]!,
    id: 'SIGNAL',
    kind: 'signal',
    x: 900,
    y: 900,
  };
  sim.hidden.hiddenSites = [source];
  Object.assign(sim.pub.astronauts[0]!, { x: 901, y: 900 });
  discoverySystem(sim, 0);
  expect(sim.pub.astronauts[0]!.scan).toBeNull();
  expect(sim.pub.signal.found).toBe(false);
  sim.pub.signal.located = true;
  sim.pub.astronauts[0]!.x = 950;
  discoverySystem(sim, 0);
  expect(sim.pub.astronauts[0]!.scan).toEqual({ dist: 50, bearing: Math.PI });
  sim.pub.astronauts[0]!.x = 901;
  discoverySystem(sim, 0);
  discoverySystem(sim, 0);
  expect(sim.pub.signal.found).toBe(true);
  expect(sim.pub.fx.filter((fx) => fx.type === 'signal_found')).toHaveLength(1);
});

it('does not scan or discover during countdown, or while inside/down/lost', () => {
  const sim = mission();
  const site = sim.hidden.hiddenSites[0]!;
  Object.assign(sim.pub.astronauts[0]!, { x: site.x, y: site.y });
  sim.pub.t = -1;
  discoverySystem(sim, 0);
  expect(sim.hidden.stats.discoveries).toBe(0);
  sim.pub.t = 0;
  for (const status of ['inside', 'down', 'lost'] as const) {
    sim.pub.astronauts[0]!.status = status;
    discoverySystem(sim, 0);
    expect(sim.pub.astronauts[0]!.scan).toBeNull();
    expect(sim.hidden.stats.discoveries).toBe(0);
  }
});
