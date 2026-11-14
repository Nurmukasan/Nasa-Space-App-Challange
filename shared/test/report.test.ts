import { expect, it } from 'vitest';
import { MODULES, PRESETS, REPORT, checkDesign, deriveParams } from '../src';
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

it('runs the full ten-minute pipeline, resolves every event, and produces a bounded report', async () => {
  const { launched } = await import('./helpers');
  const { h } = launched(3, 99);
  const sim = h.room.simulation!;
  sim.pub.astronauts.forEach((a) => {
    a.status = 'inside';
  });
  let maxBytes = 0;
  while (h.room.state.phase === 'eva') {
    h.ticks(1);
    maxBytes = Math.max(maxBytes, JSON.stringify(sim.pub).length);
  }
  expect(sim.pub.t).toBeGreaterThanOrEqual(600);
  expect(h.room.state.report!.stats.classifyMissed).toBe(sim.hidden.schedule.length);
  expect(h.room.state.report!.stats.lost).toBe(0);
  expect(h.room.state.report!.insights.at(-1)!.code).toBe('twin_insight');
  expect(maxBytes).toBeLessThan(16000);
});

it('awards teamwork for each oxygen rescue, rather than only the first', () => {
  const v = setup();
  v.sim.hidden.stats.o2Shared = 30;
  expect(scoreMission(v.sim.hidden.stats, v.sim.params, checkDesign(v.design)).teamwork).toBe(30);
});

// ----- A9: v2 findings, REDESIGN hints, timeline -------------------------------------------
function setupV2(design: MissionDesign = PRESETS.budget) {
  const sim = createSim(deriveParams(design, 1, 'signal'), ['a', 'b']);
  sim.hidden.stats.o2StoreLeft = sim.params.o2StoreInit;
  sim.hidden.stats.deepDeposited = sim.params.deepQuota;
  return { sim, design };
}
type V2 = ReturnType<typeof setupV2>;
const v2Rules: Array<[string, (v: V2) => void, MissionDesign?]> = [
  [
    'bad_pick',
    ({ sim }) => Object.assign(sim.hidden.stats, { locatePicks: 2, locateErrorSum: 400 }),
  ],
  ['no_kits', () => {}, PRESETS.balanced],
  ['fault_downtime', ({ sim }) => void (sim.hidden.stats.faultSeconds = 61)],
  ['flare_dose', ({ sim }) => void (sim.hidden.stats.doseMax = 51)],
  ['sand_trap', ({ sim }) => void (sim.hidden.stats.sandSeconds = 41)],
  ['signal_missed', ({ sim }) => void (sim.pub.signal.located = true)],
  ['blind_scouting', () => {}],
  ['good_pick', ({ sim }) => void (sim.hidden.stats.locateGood = 2)],
  ['signal_found', ({ sim }) => void (sim.hidden.stats.signalRetrieved = true)],
];
// Rules whose condition already holds at mission start are switched off first.
const v2Off: Record<string, (v: V2) => void> = {
  no_kits: ({ sim }) => void (sim.hidden.stats.stationsDeployed = 1),
  blind_scouting: ({ sim }) => void (sim.hidden.stats.discoveries = 2),
};
for (const [code, trigger, design] of v2Rules)
  it(`v2 insight ${code} triggers only on its condition, never in free`, () => {
    const v = setupV2(design);
    const on = v2Off[code];
    if (on) {
      on(v);
      expect(buildInsights(v.sim, v.design).some((i) => i.code === code)).toBe(false);
      const fresh = setupV2(design);
      expect(buildInsights(fresh.sim, fresh.design).some((i) => i.code === code)).toBe(true);
    } else {
      expect(buildInsights(v.sim, v.design).some((i) => i.code === code)).toBe(false);
      trigger(v);
      expect(buildInsights(v.sim, v.design).some((i) => i.code === code)).toBe(true);
    }
    const free = setup(design ?? PRESETS.budget);
    trigger(free as unknown as V2);
    Object.assign(free.sim.hidden.stats, {
      locatePicks: 2,
      locateErrorSum: 400,
      locateGood: 2,
      faultSeconds: 61,
      doseMax: 51,
      sandSeconds: 41,
      signalRetrieved: true,
    });
    expect(buildInsights(free.sim, free.design).some((i) => i.code === code)).toBe(false);
  });

it('blind scouting needs no GPR and at least three anomalies', () => {
  const gpr = setupV2({ ...PRESETS.budget, modules: [...PRESETS.budget.modules, 'gpr'] });
  expect(buildInsights(gpr.sim, gpr.design).some((i) => i.code === 'blind_scouting')).toBe(false);
});

it('every REDESIGN hint names an existing module the design does not carry', () => {
  const v = setupV2();
  for (const [, trigger] of v2Rules) trigger(v);
  for (const [, trigger] of rules) trigger(v as never);
  const all = [...buildInsights(v.sim, v.design)];
  const old = setup();
  for (const [, trigger] of rules) trigger(old);
  all.push(...buildInsights(old.sim, old.design));
  const fixes = all.filter((i) => i.fix);
  expect(fixes.length).toBeGreaterThan(0);
  for (const i of fixes) {
    expect(Object.prototype.hasOwnProperty.call(MODULES, i.fix!.module!)).toBe(true);
    expect(PRESETS.budget.modules).not.toContain(i.fix!.module);
    expect(i.tone).toBe('bad');
  }
  expect(all.find((i) => i.code === 'no_drill_deep')?.fix).toEqual({ module: 'drill' });
});

it('bad picks suggest the seismometer network only when stations are short', () => {
  const v = setupV2(PRESETS.balanced);
  Object.assign(v.sim.hidden.stats, { locatePicks: 2, locateErrorSum: 400 });
  const pick = buildInsights(v.sim, v.design).find((i) => i.code === 'bad_pick')!;
  expect(pick.fix).toBeUndefined();
});

it('the report timeline is bounded and in time order', async () => {
  const { buildReport } = await import('../src/sim/scoring');
  const { pushFx } = await import('../src/sim/sim');
  const v = setupV2();
  for (let i = 0; i < REPORT.timelineMax + 20; i++) {
    v.sim.pub.t = i;
    pushFx(v.sim, { type: i % 2 ? 'deposit' : 'discovery' });
    pushFx(v.sim, { type: 'ping' });
  }
  const r = buildReport(v.sim, v.design, checkDesign(v.design, 'signal'));
  expect(r.timeline).toHaveLength(REPORT.timelineMax);
  expect(r.timeline.every((e, i) => i === 0 || r.timeline[i - 1]!.t <= e.t)).toBe(true);
  expect(r.timeline.some((e) => e.type === 'ping')).toBe(false);
});

it('no drill finding follows the scenario: never in training, from the deep objective in signal', () => {
  const training = createSim(deriveParams(PRESETS.budget, 1, 'training'), ['a']);
  expect(training.pub.objectives.some((o) => o.kind === 'deliver_deep')).toBe(false);
  expect(buildInsights(training, PRESETS.budget).some((i) => i.code === 'no_drill_deep')).toBe(
    false,
  );
  const signal = setupV2();
  signal.sim.hidden.stats.deepDeposited = 0;
  expect(buildInsights(signal.sim, signal.design).some((i) => i.code === 'no_drill_deep')).toBe(
    true,
  );
});

it('lean design in v2 needs the scenario primaries, not the v1 quota', () => {
  const v = setupV2();
  v.sim.hidden.stats.samplesDeposited = 99;
  expect(buildInsights(v.sim, v.design).some((i) => i.code === 'lean_design')).toBe(false);
  for (const o of v.sim.pub.objectives) if (o.primary) o.state = 'done';
  expect(buildInsights(v.sim, v.design).some((i) => i.code === 'lean_design')).toBe(true);
});
