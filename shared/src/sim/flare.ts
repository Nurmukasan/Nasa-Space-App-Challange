// Solar particle event and radiation dose (docs/product-logic.md 7.15).
// Phase 0 stub (owner A, task A8).
import type { Sim, System } from './sim';

/** Director/beat hook: warn at warnAt, flare from warnAt + leadS for durS seconds. */
export function scheduleFlare(_sim: Sim, _warnAt: number, _leadS: number, _durS: number): void {}

export const flareSystem: System = () => {};
