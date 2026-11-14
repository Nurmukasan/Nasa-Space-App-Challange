import type { EvaState } from '@rs/shared';

/**
 * Latest two EVA snapshots, outside React on purpose: Phaser and canvas code read
 * them every frame without causing re-renders. React gets a throttled copy (store.hud).
 */
export const snaps = {
  prev: null as EvaState | null,
  curr: null as EvaState | null,
  prevAt: 0,
  currAt: 0,
};

export function pushSnap(s: EvaState): void {
  snaps.prev = snaps.curr;
  snaps.prevAt = snaps.currAt;
  snaps.curr = s;
  snaps.currAt = performance.now();
}

export function clearSnaps(): void {
  snaps.prev = null;
  snaps.curr = null;
}
