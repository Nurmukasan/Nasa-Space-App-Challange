import { FAULTS, LOCATE, O2, OBJECTIVE, SCORE } from '../balance';
import type {
  DesignCheck,
  Grade,
  MissionDesign,
  MissionParams,
  MissionReport,
  MissionStats,
  Objective,
  ScoreBreakdown,
} from '../types';
import { primariesDone } from './objectives';
import { revealKey } from './signal';
import { dosePenalty } from './flare';
import { buildInsights } from './insights';
export { buildInsights } from './insights';
import type { Sim } from './sim';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function scoreMission(
  stats: MissionStats,
  params: MissionParams,
  check: DesignCheck,
  objectives?: Objective[],
): ScoreBreakdown {
  // Secondary objectives add teamwork; all-aboard is already rewarded by allAboardBonus.
  const secondaries = (objectives ?? []).filter(
    (o) => !o.primary && o.kind !== 'all_aboard' && o.state === 'done',
  ).length;
  const science = clamp(
    Math.round(
      ((stats.scienceRaw +
        (params.objective === 'geophysics'
          ? stats.classifyCorrect * SCORE.geoClassifyScience
          : 0)) *
        params.dataFactor *
        SCORE.scienceMax) /
        params.scienceFull,
    ),
    0,
    SCORE.scienceMax,
  );
  const survivors = stats.crew - stats.lost;
  const safety = clamp(
    Math.round((SCORE.safetyMax * survivors) / Math.max(1, stats.crew)) -
      stats.breaches * SCORE.breachPenalty -
      Math.max(0, stats.downs - stats.lost) * SCORE.downPenalty -
      dosePenalty(stats.doseMax),
    0,
    SCORE.safetyMax,
  );
  const t = check.totals;
  const budgetLeft = clamp((t.budget - t.cost) / t.budget, 0, 1);
  const massLeft = clamp((t.massCapKg - t.massKg) / t.massCapKg, 0, 1);
  const storeLeft = clamp(stats.o2StoreLeft / Math.max(1, params.o2StoreInit), 0, 1);
  const timeLeft = clamp((params.durationS - stats.endedAtS) / params.durationS, 0, 1);
  const efficiency =
    survivors === 0
      ? 0
      : clamp(
          Math.round(80 * budgetLeft * 2 + 40 * massLeft + 40 * storeLeft + 40 * timeLeft * 2),
          0,
          SCORE.efficiencyMax,
        );
  const teamwork = clamp(
    stats.classifyCorrect * SCORE.classifyBonus -
      stats.falseAlarms * SCORE.falseAlarmPenalty +
      Math.floor(stats.o2Shared / O2.shareAmount) * SCORE.shareBonus +
      (stats.allAboard ? SCORE.allAboardBonus : 0) +
      secondaries * OBJECTIVE.secondaryBonus +
      stats.locateGood * LOCATE.goodBonus +
      stats.repairs * FAULTS.repairBonus,
    0,
    SCORE.teamworkMax,
  );
  const total = science + safety + efficiency + teamwork;
  // With objectives: the scenario's primaries decide; without: the v1 quota rule.
  const success =
    survivors > 0 &&
    (objectives && objectives.length > 0
      ? primariesDone(objectives)
      : stats.samplesDeposited >= params.quota && stats.deepDeposited >= params.deepQuota);
  let grade: Grade = 'D';
  if (total >= SCORE.grades.S) grade = 'S';
  else if (total >= SCORE.grades.A) grade = 'A';
  else if (total >= SCORE.grades.B) grade = 'B';
  else if (total >= SCORE.grades.C) grade = 'C';
  if (!success && (grade === 'S' || grade === 'A' || grade === 'B')) grade = 'C';
  return { science, safety, efficiency, teamwork, total, grade, success };
}

export function buildReport(sim: Sim, design: MissionDesign, check: DesignCheck): MissionReport {
  return {
    score: scoreMission(sim.hidden.stats, sim.params, check, sim.pub.objectives),
    stats: { ...sim.hidden.stats },
    insights: buildInsights(sim, design),
    design: { ...design, modules: [...design.modules] },
    seed: sim.params.seed,
    scenario: sim.params.scenario,
    objectives: sim.pub.objectives.map((o) => ({ ...o })),
    timeline: sim.hidden.timeline.map((e) => ({ ...e })),
    awards: [],
    reveal: revealKey(sim),
  };
}
