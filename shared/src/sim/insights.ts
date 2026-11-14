import { DIG, FLARE, INSIGHTS, LANDER_POS, METERS_PER_PX, O2, REPORT_INSIGHTS } from '../balance';
import { MODULES } from '../catalog';
import { checkDesign } from '../design';
import type { Insight, MissionDesign, ModuleId } from '../types';
import type { Sim } from './sim';

/** Rules return data keys; localized copy and sourced fact cards belong to the client. */
export function buildInsights(sim: Sim, design: MissionDesign): Insight[] {
  const s = sim.hidden.stats,
    p = sim.params;
  const has = (id: MissionDesign['modules'][number]) => design.modules.includes(id);
  const crew = Math.max(1, s.crew);
  const success =
    s.crew > s.lost && s.samplesDeposited >= p.quota && s.deepDeposited >= p.deepQuota;
  const totals = checkDesign(design).totals;
  const budgetFrac = (totals.budget - totals.cost) / totals.budget;
  const out: Insight[] = [];
  const add = (
    when: boolean,
    code: string,
    tone: Insight['tone'],
    params?: Insight['params'],
    fixModule?: ModuleId | null,
  ) => {
    if (!when) return;
    const insight: Insight = { code, tone, params };
    // Never suggest a module the design already carries.
    if (fixModule && !has(fixModule)) insight.fix = { module: fixModule };
    out.push(insight);
  };
  const v2 = p.scenario !== 'free';
  add(s.lost > 0, 'lost_crew', 'bad', { count: s.lost, minute: Math.round(s.endedAtS / 60) });
  add(
    s.deepDeposited < p.deepQuota && !has('drill'),
    'no_drill_deep',
    'bad',
    {
      seconds: DIG.deepDepth / DIG.shovelRate,
      oxygen: (DIG.deepDepth / DIG.shovelRate) * O2.dig,
    },
    'drill',
  );
  add(
    !has('tanks_xl') && s.refills / crew >= INSIGHTS.frequentRefills,
    'small_tanks',
    'bad',
    {
      count: s.refills,
      perCrew: s.refills / crew,
      massKg: MODULES.tanks_xl.massKg,
    },
    'tanks_xl',
  );
  add(
    !has('rtg') && !has('battery') && s.o2StoreLeft < p.o2StoreInit * INSIGHTS.lowStoreFrac,
    'night_power',
    'bad',
    { oxygen: Math.round(s.o2StoreLeft) },
    'battery',
  );
  add(
    p.stations === 1 && s.classifyWrong > 0,
    'single_station',
    'bad',
    { count: s.classifyWrong },
    'seismo_net',
  );
  add(s.breaches > 0, 'breach', 'bad', { count: s.breaches });
  const distance = s.distanceRun + s.distanceWalked;
  add(distance > 0 && s.distanceRun / distance > INSIGHTS.runFrac, 'ran_too_much', 'bad', {
    pct: distance > 0 ? Math.round((s.distanceRun / distance) * 100) : 0,
  });
  add(s.falseAlarms > 0, 'false_alarms', 'bad', { count: s.falseAlarms }, 'weather');
  add(
    p.dataFactor < INSIGHTS.dataFrac,
    'data_bottleneck',
    'bad',
    { pct: Math.round(p.dataFactor * 100) },
    'antenna_hg',
  );
  // v2 findings: training and RED SIGNAL only, so Free mission reports stay as in v1.
  const R = REPORT_INSIGHTS;
  const meanPickPx = s.locatePicks > 0 ? s.locateErrorSum / s.locatePicks : 0;
  add(
    v2 && s.locatePicks >= R.minPicks && meanPickPx > R.badPickPx,
    'bad_pick',
    'bad',
    { count: s.locatePicks, meters: Math.round(meanPickPx * METERS_PER_PX) },
    p.stations < R.netStations ? 'seismo_net' : null,
  );
  add(v2 && p.kits > 0 && s.stationsDeployed === 0, 'no_kits', 'bad', { count: p.kits });
  add(
    v2 && s.faultSeconds > R.faultDowntimeS,
    'fault_downtime',
    'bad',
    { seconds: Math.round(s.faultSeconds) },
    'o2_reserve',
  );
  add(v2 && s.doseMax > FLARE.doseLimit, 'flare_dose', 'bad', {
    dose: Math.round(s.doseMax),
    limit: FLARE.doseLimit,
  });
  add(v2 && s.sandSeconds > R.sandS, 'sand_trap', 'bad', { seconds: Math.round(s.sandSeconds) });
  const src = sim.hidden.signalSource;
  add(
    v2 && sim.pub.signal.located && !s.signalRetrieved,
    'signal_missed',
    'bad',
    {
      meters: src
        ? Math.round(Math.hypot(src.x - LANDER_POS.x, src.y - LANDER_POS.y) * METERS_PER_PX)
        : 0,
    },
    has('tanks_xl') ? 'drill' : 'tanks_xl',
  );
  // Every hidden site except the signal source starts as one orbital anomaly.
  const anomaliesAtStart =
    sim.pub.anomalies.length + s.discoveries - (sim.pub.signal.found ? 1 : 0);
  add(
    v2 && !p.hasGpr && s.discoveries < R.blindDiscoveries && anomaliesAtStart >= R.blindAnomalies,
    'blind_scouting',
    'bad',
    { count: s.discoveries },
    'gpr',
  );
  add(p.stations === 3 && s.classifyCorrect >= INSIGHTS.netCorrect, 'net_good', 'good', {
    count: s.classifyCorrect,
  });
  add(v2 && s.locateGood >= R.goodPicks, 'good_pick', 'good', { count: s.locateGood });
  add(has('tanks_xl') && s.refills / crew < INSIGHTS.fewRefills, 'xl_tanks_good', 'good', {
    count: s.refills,
  });
  add(budgetFrac >= INSIGHTS.leanBudgetFrac && success, 'lean_design', 'good', {
    saved: totals.budget - totals.cost,
    pct: Math.round(budgetFrac * 100),
  });
  add(v2 && s.signalRetrieved, 'signal_found', 'good');
  add(s.allAboard, 'all_aboard', 'good', { count: s.crew });
  const twin = has('seismo_net')
    ? 'insight'
    : has('drill') && design.objective === 'astrobiology'
      ? 'perseverance'
      : design.objective === 'ice' || design.site === 'arcadia'
        ? 'phoenix'
        : has('rtg')
          ? 'curiosity'
          : 'mer';
  return [...out.slice(0, INSIGHTS.maxCausal), { code: `twin_${twin}`, tone: 'neutral' }];
}
