// Digging mini-game (docs/product-logic.md 7.5.1): SPACE strokes on a timing bar.
// A stroke in the zone digs deeper, a run of good strokes digs deeper still, a miss
// costs oxygen and time. Training and RED SIGNAL only; Free mission keeps hold-SPACE.
import { CREW, DIG_GAME } from '../balance';
import { createRng, hashString } from '../rng';
import type { Astronaut, DigGame, DigGrade } from '../types';
import { digSessionValid, excavate, siteInReach } from './digging';
import type { Sim } from './sim';

/** Marker position along the bar (0..1) at mission time t: a back-and-forth sweep. */
export function digMarker(dig: DigGame, t: number): number {
  const u = ((((t - dig.t0) / DIG_GAME.sweepS) % 2) + 2) % 2;
  return u <= 1 ? u : 2 - u;
}

export function digGrade(dig: DigGame, phase: number): DigGrade {
  const off = Math.abs(phase - dig.zone);
  return off <= DIG_GAME.perfectHalf ? 'perfect' : off <= DIG_GAME.goodHalf ? 'good' : 'miss';
}

/** Depth multiplier of the current run of good strokes. */
export function digComboMul(combo: number): number {
  return 1 + DIG_GAME.comboStep * Math.min(combo, DIG_GAME.comboMax);
}

function zoneFor(sim: Sim, a: Astronaut, n: number): number {
  const rng = createRng((sim.params.seed ^ hashString(a.id) ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
  return rng.range(DIG_GAME.zoneMargin, 1 - DIG_GAME.zoneMargin);
}

/**
 * The marker position the stroke is judged at: what the player saw, if the marker really was
 * there in the last lagWindowS seconds (the client draws one network trip late) or within one
 * tick ahead (the server judges at its last tick); otherwise the server's own position.
 */
export function judgedPhase(dig: DigGame, t: number, claimed: number): number {
  for (let back = -DIG_GAME.leadS; back <= DIG_GAME.lagWindowS + 1e-9; back += DIG_GAME.lagStepS) {
    const at = t - back;
    if (at < dig.t0) break;
    if (Math.abs(digMarker(dig, at) - claimed) <= DIG_GAME.phaseEps) return claimed;
  }
  return digMarker(dig, t);
}

/** SPACE in the mini-game: the first press starts the bar, later presses are strokes. */
export function digStrike(sim: Sim, a: Astronaut, claimed: number): void {
  const t = sim.pub.t;
  if (a.status !== 'active' || a.inRover || a.carrying.length >= sim.params.carryCap) return;
  const site = siteInReach(sim, a);
  if (!site) return;
  if (!a.dig || !digSessionValid(sim, a)) {
    a.dig = { t0: t, zone: zoneFor(sim, a, 0), n: 0, combo: 0, lastT: t, last: null, lockUntil: t };
    a.digging = true;
    return;
  }
  const dig = a.dig;
  if (t < dig.lockUntil) return;
  const grade = digGrade(dig, judgedPhase(dig, t, claimed));
  const amount =
    sim.params.digRate *
    DIG_GAME.strokeS *
    DIG_GAME.mul[grade] *
    digComboMul(dig.combo) *
    CREW.digMul[a.crewClass];
  dig.combo = grade === 'miss' ? 0 : dig.combo + 1;
  dig.n++;
  dig.zone = zoneFor(sim, a, dig.n);
  dig.lastT = t;
  dig.last = grade;
  dig.lockUntil = t + (grade === 'miss' ? DIG_GAME.missLockS : DIG_GAME.cooldownS);
  if (grade === 'miss') a.o2 = Math.max(0, a.o2 - DIG_GAME.missO2);
  sim.hidden.stats.digStrokes[grade]++;
  // A full hand ends the session inside excavate().
  excavate(sim, a, site, amount);
}
