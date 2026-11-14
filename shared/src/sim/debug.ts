// Debug commands of the v2 systems. Each owner adds their own cases (docs/phases.md 3.2).
import type { DebugCmd } from '../protocol';
import { SEISMIC } from '../balance';
import { emitPulse } from './signal';
import type { Sim } from './sim';

export function debugSim(sim: Sim, cmd: DebugCmd, _n?: number): void {
  switch (cmd) {
    // owner A
    case 'event_signal':
      emitPulse(sim, sim.pub.t + SEISMIC.debugDelayS);
      return;
    // owner A: fault, flare, next_act
    // owner B: devil, reveal_all
    default:
      return;
  }
}
