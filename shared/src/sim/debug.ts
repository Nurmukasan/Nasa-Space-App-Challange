// Debug commands of the v2 systems. Each owner adds their own cases (docs/phases.md 3.2).
import { spawnDevil } from './devils';
import type { DebugCmd } from '../protocol';
import { FLARE, SEISMIC } from '../balance';
import { faultActive, spawnFault } from './faults';
import { emitPulse } from './signal';
import { scheduleFlare } from './flare';
import { SCENARIOS } from '../scenarios';
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
    case 'flare':
      scheduleFlare(sim, sim.pub.t, FLARE.leadS, FLARE.durS);
      return;
    case 'next_act': {
      // Jump the clock to the next act; its beats (title, radio) run on the next tick.
      const next = SCENARIOS[sim.params.scenario].acts.find((a) => a.from > sim.pub.t);
      if (next) sim.pub.t = next.from;
      return;
    }
    // owner B: devil, reveal_all
    case 'reveal_all':
      for (const site of sim.hidden.hiddenSites) {
        site.known = true;
        sim.pub.sites.push(site);
        if (site.kind === 'signal') sim.pub.signal.found = true;
      }
      sim.hidden.hiddenSites = [];
      sim.pub.anomalies = [];
      return;
    case 'devil':
      spawnDevil(sim, sim.pub.astronauts.find((a) => a.status === 'active') ?? sim.pub.lander);
      return;
    default:
      return;
  }
}
