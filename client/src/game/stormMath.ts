import type { EvaState } from '@rs/shared';

/** Seconds a storm takes to build up and to fade out. */
export const STORM_RAMP_S = 3;

/** 0 outside a storm, ramping to 1 in the middle of it. */
export function stormLevel(snap: Pick<EvaState, 't' | 'weather'>): number {
  const storm = snap.weather.storm;
  if (!storm || snap.t < storm.tStart || snap.t >= storm.tEnd) return 0;
  return Math.min(1, (snap.t - storm.tStart) / STORM_RAMP_S, (storm.tEnd - snap.t) / STORM_RAMP_S);
}

const smooth = (lo: number, hi: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return k * k * (3 - 2 * k);
};

/**
 * Wind comes in waves: calm stretches broken by hard gusts every ten seconds or so. A pure
 * function of the mission clock, so every client sees the same gust at the same moment.
 */
export function gust(t: number): number {
  const wave = (Math.sin(t * 0.8) * 0.6 + Math.sin(t * 0.31 + 1.7) * 0.4 + 1) / 2;
  return smooth(0.55, 0.95, wave);
}
