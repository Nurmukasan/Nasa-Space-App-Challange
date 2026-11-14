import { DIG, INSIGHTS, O2 } from '../balance';
import { MODULES } from '../catalog';
import { checkDesign } from '../design';
import type { Insight, MissionDesign } from '../types';
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
  const add = (when: boolean, code: string, tone: Insight['tone'], params?: Insight['params']) => {
    if (when) out.push({ code, tone, params });
  };
  add(s.lost > 0, 'lost_crew', 'bad', { count: s.lost, minute: Math.round(s.endedAtS / 60) });
  add(s.deepDeposited < p.deepQuota && !has('drill'), 'no_drill_deep', 'bad', {
    seconds: DIG.deepDepth / DIG.shovelRate,
    oxygen: (DIG.deepDepth / DIG.shovelRate) * O2.dig,
  });
  add(!has('tanks_xl') && s.refills / crew >= INSIGHTS.frequentRefills, 'small_tanks', 'bad', {
    count: s.refills,
    perCrew: s.refills / crew,
    massKg: MODULES.tanks_xl.massKg,
  });
  add(
    !has('rtg') && !has('battery') && s.o2StoreLeft < p.o2StoreInit * INSIGHTS.lowStoreFrac,
    'night_power',
    'bad',
    { oxygen: Math.round(s.o2StoreLeft) },
  );
  add(p.stations === 1 && s.classifyWrong > 0, 'single_station', 'bad', { count: s.classifyWrong });
  add(s.breaches > 0, 'breach', 'bad', { count: s.breaches });
  const distance = s.distanceRun + s.distanceWalked;
  add(distance > 0 && s.distanceRun / distance > INSIGHTS.runFrac, 'ran_too_much', 'bad', {
    pct: distance > 0 ? Math.round((s.distanceRun / distance) * 100) : 0,
  });
  add(s.falseAlarms > 0, 'false_alarms', 'bad', { count: s.falseAlarms });
  add(p.dataFactor < INSIGHTS.dataFrac, 'data_bottleneck', 'bad', {
    pct: Math.round(p.dataFactor * 100),
  });
  add(p.stations === 3 && s.classifyCorrect >= INSIGHTS.netCorrect, 'net_good', 'good', {
    count: s.classifyCorrect,
  });
  add(has('tanks_xl') && s.refills / crew < INSIGHTS.fewRefills, 'xl_tanks_good', 'good', {
    count: s.refills,
  });
  add(budgetFrac >= INSIGHTS.leanBudgetFrac && success, 'lean_design', 'good', {
    saved: totals.budget - totals.cost,
    pct: Math.round(budgetFrac * 100),
  });
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
