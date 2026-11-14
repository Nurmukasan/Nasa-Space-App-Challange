// Balance soak: N bot missions in-process, then a summary for the game designer (task A12).
//   npx tsx tools/mission-soak.ts --scenario signal --runs 10 --crew 2 [--preset science] [--seed 1]
import { PRESETS, SCENARIOS } from '@rs/shared';
import type { PresetId, ScenarioId } from '@rs/shared';
import { runMission } from './soak';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const scenario = arg('scenario', 'signal') as ScenarioId;
const runs = Number(arg('runs', '10'));
const crew = Number(arg('crew', '2'));
const seed0 = Number(arg('seed', '1'));
const presetArg = arg('preset', '');
if (!Object.prototype.hasOwnProperty.call(SCENARIOS, scenario)) throw new Error('bad --scenario');
if (presetArg && !Object.prototype.hasOwnProperty.call(PRESETS, presetArg))
  throw new Error('bad --preset');
if (!Number.isInteger(runs) || runs < 1 || !Number.isInteger(crew) || crew < 1 || crew > 3)
  throw new Error('--runs >= 1, --crew 1..3');
const preset = (presetArg || undefined) as PresetId | undefined;

interface Row {
  seed: number;
  ok: string;
  grade: string;
  total: number;
  sci: number;
  safe: number;
  eff: number;
  team: number;
  lost: number;
  samples: number;
  deep: number;
  found: number;
  events: number;
  goodPicks: string;
  stations: number;
  repairs: number;
  located: number | string;
  signal: string;
  ended: number;
}
const rows: Row[] = [];
const started = Date.now();
for (let i = 0; i < runs; i++) {
  // Distinct room seeds; the training scenario pins its own seed anyway.
  const r = runMission({ seed: seed0 + i * 7919, scenario, crew, preset });
  const st = r.report.stats;
  rows.push({
    seed: r.seed,
    ok: r.report.score.success ? 'yes' : 'no',
    grade: r.report.score.grade,
    total: r.report.score.total,
    sci: r.report.score.science,
    safe: r.report.score.safety,
    eff: r.report.score.efficiency,
    team: r.report.score.teamwork,
    lost: st.lost,
    samples: st.samplesDeposited,
    deep: st.deepDeposited,
    found: st.discoveries,
    events: r.events,
    goodPicks: `${st.locateGood}/${st.locatePicks}`,
    stations: st.stationsDeployed,
    repairs: st.repairs,
    located: r.signalLocatedAtS ?? '-',
    signal: st.signalRetrieved ? 'yes' : 'no',
    ended: Math.round(st.endedAtS),
  });
}
console.table(rows);
const mean = (k: 'total' | 'lost') => rows.reduce((s, r) => s + r[k], 0) / rows.length;
const grades = rows.reduce<Record<string, number>>(
  (g, r) => ((g[r.grade] = (g[r.grade] ?? 0) + 1), g),
  {},
);
console.log(
  [
    `scenario ${scenario}, preset ${preset ?? SCENARIOS[scenario].quickPreset}, crew ${crew}, runs ${runs}`,
    `success ${rows.filter((r) => r.ok === 'yes').length}/${runs}`,
    `signal retrieved ${rows.filter((r) => r.signal === 'yes').length}/${runs}`,
    `mean score ${mean('total').toFixed(0)}, crew lost per mission ${mean('lost').toFixed(2)}`,
    `grades ${JSON.stringify(grades)}`,
    `${((Date.now() - started) / 1000).toFixed(1)}s wall time`,
  ].join('\n'),
);
