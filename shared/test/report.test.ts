import { expect, it } from 'vitest';
import { PRESETS, checkDesign, deriveParams } from '../src';
import type { MissionDesign, PresetId } from '../src';
import { createSim } from '../src/sim/sim';
import { buildInsights, scoreMission } from '../src/sim/scoring';

function setup(design: MissionDesign = PRESETS.budget) {
  const sim = createSim(deriveParams(design, 1), ['a', 'b']);
  sim.hidden.stats.o2StoreLeft = sim.params.o2StoreInit;
  sim.hidden.stats.deepDeposited = sim.params.deepQuota;
  return { sim, design };
}
const rules: Array<[string, (v: ReturnType<typeof setup>) => void, MissionDesign?]> = [
  [
    'lost_crew',
    ({ sim }) => {
      sim.hidden.stats.lost = 1;
    },
  ],
  [
    'no_drill_deep',
    ({ sim }) => {
      sim.hidden.stats.deepDeposited = 0;
    },
  ],
  [
    'small_tanks',
    ({ sim }) => {
      sim.hidden.stats.refills = 6;
    },
  ],
  [
    'night_power',
    ({ sim }) => {
      sim.hidden.stats.o2StoreLeft = 0;
    },
  ],
  [
    'single_station',
    ({ sim }) => {
      sim.hidden.stats.classifyWrong = 1;
    },
  ],
  [
    'breach',
    ({ sim }) => {
      sim.hidden.stats.breaches = 1;
    },
  ],
  [
    'ran_too_much',
    ({ sim }) => {
      sim.hidden.stats.distanceRun = 36;
      sim.hidden.stats.distanceWalked = 64;
    },
  ],
  [
    'false_alarms',
    ({ sim }) => {
      sim.hidden.stats.falseAlarms = 1;
    },
  ],
  [
    'data_bottleneck',
    ({ sim }) => {
      sim.params.dataFactor = 0.7;
    },
  ],
  [
    'net_good',
    ({ sim }) => {
      sim.hidden.stats.classifyCorrect = 2;
    },
    PRESETS.balanced,
  ],
  [
    'xl_tanks_good',
    ({ sim }) => {
      sim.hidden.stats.refills = 0;
    },
    PRESETS.balanced,
  ],
  [
    'lean_design',
    ({ sim }) => {
      sim.hidden.stats.samplesDeposited = sim.params.quota;
    },
  ],
  [
    'all_aboard',
    ({ sim }) => {
      sim.hidden.stats.allAboard = true;
    },
  ],
];
for (const [code, trigger, design] of rules)
  it(`insight ${code} triggers only on its condition`, () => {
    const v = setup(design);
    if (code === 'xl_tanks_good') v.sim.hidden.stats.refills = 4;
    expect(buildInsights(v.sim, v.design).some((i) => i.code === code)).toBe(false);
    trigger(v);
    expect(buildInsights(v.sim, v.design).some((i) => i.code === code)).toBe(true);
  });
it('limits causal insights to five, bad before good, then one extra neutral twin', () => {
  const v = setup();
  for (const [, trigger] of rules) trigger(v);
  const insights = buildInsights(v.sim, v.design);
  expect(insights).toHaveLength(6);
  expect(insights.at(-1)!.tone).toBe('neutral');
  const tones = insights.slice(0, -1).map((i) => i.tone);
  expect(tones).toEqual(
    [...tones].sort((a, b) =>
      a === 'bad' && b === 'good' ? -1 : a === 'good' && b === 'bad' ? 1 : 0,
    ),
  );
});
for (const preset of ['balanced', 'budget', 'science'] as PresetId[])
  it(`${preset} has exactly one mission twin`, () => {
    const v = setup(PRESETS[preset]);
    expect(buildInsights(v.sim, v.design).filter((i) => i.code.startsWith('twin_'))).toHaveLength(
      1,
    );
  });
for (const [design, twin] of [
  [PRESETS.balanced, 'twin_insight'],
  [{ ...PRESETS.budget, modules: [...PRESETS.budget.modules, 'drill'] }, 'twin_perseverance'],
  [{ ...PRESETS.budget, objective: 'ice' }, 'twin_phoenix'],
  [{ ...PRESETS.budget, modules: [...PRESETS.budget.modules, 'rtg'] }, 'twin_curiosity'],
  [PRESETS.budget, 'twin_mer'],
] as const)
  it(`chooses ${twin} with first-match priority`, () => {
    const d = { ...design, modules: [...design.modules] } as MissionDesign;
    const v = setup(d);
    expect(buildInsights(v.sim, d).at(-1)!.code).toBe(twin);
  });
it('geophysics adds 12 raw science per correct classification before data return', () => {
  const v = setup({ ...PRESETS.balanced, objective: 'geophysics' });
  v.sim.hidden.stats.classifyCorrect = 2;
  const s = scoreMission(v.sim.hidden.stats, v.sim.params, checkDesign(v.design));
  expect(s.science).toBe(Math.round((24 * v.sim.params.dataFactor * 400) / 220));
});
it('success needs survivors, total quota and deep quota; failure grade cannot exceed C', () => {
  const v = setup();
  const stats = v.sim.hidden.stats;
  const check = checkDesign(v.design);
  Object.assign(stats, {
    scienceRaw: 10000,
    samplesDeposited: 100,
    deepDeposited: 100,
    classifyCorrect: 5,
    allAboard: true,
  });
  expect(scoreMission(stats, v.sim.params, check).success).toBe(true);
  for (const patch of [{ lost: 2 }, { samplesDeposited: 0 }, { deepDeposited: 0 }]) {
    const score = scoreMission({ ...stats, ...patch }, v.sim.params, check);
    expect(score.success).toBe(false);
    expect(['C', 'D']).toContain(score.grade);
  }
});
