// Debug commands of the v2 systems. Each owner adds their own cases (docs/phases.md 3.2).
import { spawnDevil } from './devils';
import type { DebugCmd } from '../protocol';
import { SEISMIC } from '../balance';
import { faultActive, spawnFault } from './faults';
import { emitPulse } from './signal';
import type { Sim } from './sim';

export function debugSim(sim: Sim, cmd: DebugCmd, _n?: number): void {
  switch (cmd) {
    // owner A
    case 'event_signal':
      emitPulse(sim, sim.pub.t + SEISMIC.debugDelayS);
      return;
    case 'fault': {
      const kind = (['moxie_clog', 'antenna_drift', 'panel_dust'] as const).find(
        (k) => !faultActive(sim, k),
      );
      if (kind) spawnFault(sim, kind);
      return;
    }
    // owner A: flare, next_act
    // owner B: devil, reveal_all
    case 'devil':
      spawnDevil(sim, sim.pub.astronauts.find((a) => a.status === 'active') ?? sim.pub.lander);
      return;
    default:
      return;
  }
}
