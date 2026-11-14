// In-process mission runner for balance (docs/phases.md, task A12): no sockets, no browser,
// the mission clock runs as fast as the CPU allows. Used by tools/mission-soak.ts and its test.
import { GameRoom, TICK_DT } from '@rs/shared';
import type { EvaState, MissionReport, PresetId, ScenarioId } from '@rs/shared';
import { EvaBrain, McBrain } from './botBrain';

export interface SoakOptions {
  seed: number;
  scenario: ScenarioId;
  /** Astronaut bots; one Mission Control bot is always added. */
  crew: number;
  /** Design preset; the scenario's Quick start preset when omitted. */
  preset?: PresetId;
}

export interface SoakResult {
  seed: number;
  report: MissionReport;
  events: number;
  signalLocatedAtS: number | null;
}

export function runMission(o: SoakOptions): SoakResult {
  let snap: EvaState | null = null;
  let n = 0;
  const room = new GameRoom({
    code: 'SOAK',
    seed: o.seed,
    emit: (_target, msg) => {
      if (msg.t === 'snap') snap = msg.snap;
    },
    makeId: () => `p${n++}`,
  });
  const ids: string[] = [];
  for (let i = 0; i <= o.crew; i++) {
    const r = room.join({ name: i === 0 ? 'MC' : `EVA${i}` });
    if (!r.ok) throw new Error(`join failed: ${r.error}`);
    ids.push(r.playerId);
  }
  const [mc, ...crew] = ids as [string, ...string[]];
  room.handle(mc, { t: 'lobby:role', role: 'mc' });
  for (const id of crew) room.handle(id, { t: 'lobby:role', role: 'eva' });
  room.handle(mc, { t: 'lobby:scenario', id: o.scenario });
  if (o.preset) {
    room.handle(mc, { t: 'lobby:start', quick: false });
    room.handle(mc, { t: 'design:preset', id: o.preset });
    room.handle(mc, { t: 'design:launch' });
  } else room.handle(mc, { t: 'lobby:start', quick: true });
  if (room.state.phase !== 'eva') throw new Error(`mission did not start: ${room.state.phase}`);

  const mcBrain = new McBrain();
  const brains = crew.map((id, i) => ({ id, brain: new EvaBrain(id, i) }));
  const events = new Set<string>();
  let signalLocatedAtS: number | null = null;
  // Safety cap: countdown plus the longest scenario, with headroom.
  for (let tick = 0; room.state.phase === 'eva' && tick < 20 * 60 * 15; tick++) {
    room.tick(TICK_DT);
    const s = snap as EvaState | null;
    const p = room.state.params;
    if (!s || !p || room.state.phase !== 'eva') continue;
    for (const e of s.seismic) events.add(e.id);
    if (signalLocatedAtS === null && s.signal.located) signalLocatedAtS = Math.round(s.t);
    for (const m of mcBrain.decide(s, p)) room.handle(mc, m);
    for (const b of brains) for (const m of b.brain.decide(s, p)) room.handle(b.id, m);
  }
  const report = room.state.report;
  if (!report) throw new Error('mission did not reach the report');
  return { seed: o.seed, report, events: events.size, signalLocatedAtS };
}
