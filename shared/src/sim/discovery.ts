// Hidden sites, orbital anomalies and the helmet scanner (docs/product-logic.md 7.6).
// Phase 0 stub (owner B, task B1): every site stays known, as in v1.
import type { Sim, System } from './sim';

export function initDiscovery(_sim: Sim): void {}

export const discoverySystem: System = () => {};
