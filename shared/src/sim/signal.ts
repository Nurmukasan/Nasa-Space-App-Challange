// RED SIGNAL: hidden source, pulses and the search zone (docs/product-logic.md 7.12).
// Phase 0 stub (owner A, task A6).
import type { SeismicEvent } from '../types';
import type { Sim, System } from './sim';

/** Called by the seismic system when a RED SIGNAL pulse is resolved. */
export function onSignalResolved(_sim: Sim, _event: SeismicEvent): void {}

export const signalSystem: System = () => {};
