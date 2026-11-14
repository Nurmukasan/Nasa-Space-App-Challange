// Lander faults and repairs at service ports (docs/product-logic.md 7.16).
// Phase 0 stub (owner A, task A7).
import type { Astronaut, FaultKind } from '../types';
import type { Sim, System } from './sim';

/** Director hook: break a lander system. */
export function spawnFault(_sim: Sim, _kind: FaultKind): void {}

/** Remove a fault without a repair (a dust devil cleaning the panels). */
export function clearFault(_sim: Sim, _kind: FaultKind): void {}

export function faultActive(_sim: Sim, _kind: FaultKind): boolean {
  return false;
}

/** E-key step 4: start repairing the fault at this port. Returns true if the key press was used. */
export function tryStartRepair(_sim: Sim, _a: Astronaut): boolean {
  return false;
}

export const faultSystem: System = () => {};
