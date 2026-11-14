// Debug commands of the v2 systems. Each owner adds their own cases (docs/phases.md 3.2).
import { spawnDevil } from './devils';
import type { DebugCmd } from '../protocol';
import type { Sim } from './sim';

export function debugSim(sim: Sim, cmd: DebugCmd, _n?: number): void {
  switch (cmd) {
    // owner A: event_signal, fault, flare, next_act
    // owner B: devil, reveal_all
    case 'devil':
      spawnDevil(sim, sim.pub.astronauts.find((a) => a.status === 'active') ?? sim.pub.lander);
      return;
    default:
      return;
  }
}
