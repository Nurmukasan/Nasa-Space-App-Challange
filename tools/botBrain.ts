// Decision logic for headless players (docs/phases.md, task A12). Pure: snapshot in, messages out.
// Shared by the socket bots (tools/bots.ts) and the in-process soak (tools/mission-soak.ts).
import { LANDER_POS, WORLD_MAX, WORLD_MIN, WORLD_PX, portPos } from '@rs/shared';
import type { ClientMsg, EvaState, EventKind, MissionParams, SeismicEvent, Vec2 } from '@rs/shared';

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Signature reading, as an operator would from the seismograph (PL 7.11). */
export function classifyBySignature(e: SeismicEvent): EventKind {
  const s = e.signals[0];
  if (!s) return 'quake';
  if (s.riseS < 1) return 'impact';
  if (s.pressureDip > 0 || s.noise > 0.2) return 'wind';
  return 'quake';
}

/**
 * Epicentre from the station range rings: least squares over a coarse grid, then refined.
 * With a single station, its bearing and distance give the point directly.
 */
export function pickEpicentre(e: SeismicEvent, stations: Vec2[]): Vec2 | null {
  const rings = e.signals
    .map((s) => ({ at: stations[s.stationIdx], d: s.distEst, b: s.bearingEst }))
    .filter((r): r is { at: Vec2; d: number; b: number | null } => !!r.at && r.d > 0);
  if (rings.length === 0) return null;
  const first = rings[0]!;
  const fromBearing =
    first.b !== null
      ? { x: first.at.x + Math.cos(first.b) * first.d, y: first.at.y + Math.sin(first.b) * first.d }
      : null;
  if (rings.length === 1) return fromBearing;
  const cost = (x: number, y: number) => {
    let c = 0;
    for (const r of rings) c += (Math.hypot(x - r.at.x, y - r.at.y) - r.d) ** 2;
    // The bearing breaks the mirror ambiguity of two rings.
    if (fromBearing) c += 0.02 * ((x - fromBearing.x) ** 2 + (y - fromBearing.y) ** 2);
    return c;
  };
  let best = { x: LANDER_POS.x, y: LANDER_POS.y };
  let bestC = Infinity;
  for (const step of [32, 8, 2]) {
    const span = step === 32 ? WORLD_PX / 2 : step * 6;
    const cx = best.x,
      cy = best.y;
    for (let y = cy - span; y <= cy + span; y += step)
      for (let x = cx - span; x <= cx + span; x += step) {
        if (x < WORLD_MIN || y < WORLD_MIN || x > WORLD_MAX || y > WORLD_MAX) continue;
        const c = cost(x, y);
        if (c < bestC) {
          bestC = c;
          best = { x, y };
        }
      }
  }
  return best;
}

/** Mission Control bot: classify, pick epicentres, dispense oxygen, send crew to fault ports. */
export class McBrain {
  private answered = new Set<string>();
  private picked = new Set<string>();
  private sentToPort = new Map<string, string>();

  decide(s: EvaState, p: MissionParams): ClientMsg[] {
    const out: ClientMsg[] = [];
    for (const e of s.seismic) {
      if (s.t >= e.deadline) continue;
      const heard = Math.max(0, ...e.signals.map((x) => x.delayS)) + 0.5;
      if (s.t < e.t0 + heard) continue;
      if (!this.picked.has(e.id) && p.scenario !== 'free') {
        this.picked.add(e.id);
        const pick = pickEpicentre(e, s.stations);
        if (pick) out.push({ t: 'mc:locate', eventId: e.id, ...pick });
      }
      if (!e.signal && e.guess === null && !this.answered.has(e.id)) {
        this.answered.add(e.id);
        out.push({ t: 'mc:classify', eventId: e.id, kind: classifyBySignature(e) });
      }
    }
    for (const a of s.astronauts)
      if (a.wantsRefill && !a.refillGranted) out.push({ t: 'mc:dispense', playerId: a.id });
    // One astronaut per fault: the nearest active one goes to its port.
    for (const f of s.lander.faults) {
      if (this.sentToPort.get(f.id)) continue;
      const port = portPos(f.port);
      const crew = s.astronauts
        .filter((a) => a.status === 'active' && a.repairing === null)
        .sort((a, b) => dist(a, port) - dist(b, port))[0];
      if (!crew) continue;
      this.sentToPort.set(f.id, crew.id);
      out.push({ t: 'mc:waypoint', playerId: crew.id, x: port.x, y: port.y });
    }
    for (const [faultId, crewId] of this.sentToPort)
      if (!s.lander.faults.some((f) => f.id === faultId)) {
        this.sentToPort.delete(faultId);
        out.push({ t: 'mc:clearWaypoint', playerId: crewId });
      }
    return out;
  }
}

export { EvaBrain } from './evaBrain';
