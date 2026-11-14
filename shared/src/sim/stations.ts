// Seismometer kits deployed by the crew (docs/product-logic.md 7.7).
// Phase 0 stub (owner B, task B5).
import type { Astronaut } from '../types';
import type { Sim } from './sim';

/** E-key step 5: deploy a carried kit here. Returns true if the key press was used. */
export function tryDeployKit(_sim: Sim, _a: Astronaut): boolean {
  return false;
}
