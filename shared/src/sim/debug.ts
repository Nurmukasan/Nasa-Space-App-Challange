// Debug commands of the v2 systems. Each owner adds their own cases (docs/phases.md 3.2).
import type { DebugCmd } from '../protocol';
import type { Sim } from './sim';

export function debugSim(_sim: Sim, cmd: DebugCmd, _n?: number): void {
  switch (cmd) {
    // owner A: event_signal, fault, flare, next_act
    // owner B: devil, reveal_all
    default:
      return;
  }
}
