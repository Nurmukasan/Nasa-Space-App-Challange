import { SCORE } from '@rs/shared';
import type { Grade } from '@rs/shared';

/** Debrief timeline in ms. Each step starts after the previous one has landed. */
export const REPORT_TIMING = {
  stampMs: 450,
  rowsStartMs: 900,
  rowStepMs: 450,
  barMs: 900,
  totalGapMs: 400,
  sealGapMs: 700,
  findingsGapMs: 500,
  findingStepMs: 220,
};

export const SCORE_ROWS = [
  { key: 'science', max: SCORE.scienceMax },
  { key: 'safety', max: SCORE.safetyMax },
  { key: 'efficiency', max: SCORE.efficiencyMax },
  { key: 'teamwork', max: SCORE.teamworkMax },
] as const;

export const SCORE_TOTAL_MAX = SCORE_ROWS.reduce((sum, row) => sum + row.max, 0);

/** Seal color per grade. Gold for the best, red for the worst. */
export const GRADE_COLORS: Record<Grade, string> = {
  S: '#ffd24a',
  A: '#78dc6e',
  B: '#50e6f0',
  C: '#ffb030',
  D: '#f0463c',
};
