// Crew awards for the report (docs/product-logic.md 8.4): one per player, first match by order.
import { AWARDS } from '../balance';
import type { Award, CrewStats } from '../types';
import type { Sim } from './sim';

type CrewAward = (typeof AWARDS.order)[number];

/** Score for a crew award, or null when the astronaut does not qualify. Higher is better. */
function value(code: CrewAward, c: CrewStats): number | null {
  switch (code) {
    case 'rock_hound':
      return c.science > 0 ? c.science : null;
    case 'explorer':
      return c.discoveries >= 1 ? c.discoveries : null;
    case 'lifeguard':
      return c.rescues >= 1 ? c.rescues : null;
    case 'mechanic':
      return c.repairs >= 1 ? c.repairs : null;
    case 'pathfinder':
      return c.distance > 0 ? c.distance : null;
    case 'iron_lungs':
      // Least suit oxygen per minute outside: negate so that higher is better.
      return c.secondsOutside >= AWARDS.ironLungsMinS ? -(c.o2Used / c.secondsOutside) * 60 : null;
  }
}

/**
 * Each award goes to the single best astronaut for it (ties: crew order) unless that astronaut
 * already holds one. The operator (or the solo player, if still empty-handed) gets
 * `seismologist` for good picks, otherwise `flight_director`.
 */
export function buildAwards(sim: Sim, operatorId: string | null): Award[] {
  const out: Award[] = [];
  const holds = (id: string) => out.some((a) => a.playerId === id);
  for (const code of AWARDS.order) {
    let best: CrewStats | null = null;
    let bestV = -Infinity;
    for (const c of sim.hidden.stats.crewStats) {
      const v = value(code, c);
      if (v !== null && v > bestV) {
        best = c;
        bestV = v;
      }
    }
    if (best && !holds(best.id))
      out.push({ code, playerId: best.id, n: Math.round(Math.abs(bestV) * 10) / 10 });
  }
  if (operatorId !== null && !holds(operatorId)) {
    const good = sim.hidden.stats.locateGood;
    out.push(
      good >= AWARDS.seismologistPicks
        ? { code: 'seismologist', playerId: operatorId, n: good }
        : { code: 'flight_director', playerId: operatorId },
    );
  }
  return out;
}
