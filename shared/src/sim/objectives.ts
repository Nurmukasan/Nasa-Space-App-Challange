// Mission objectives (docs/product-logic.md 7.18): built from scenario data, progress from
// statistics and public state, 'done' is sticky, unmet ones fail at liftoff.
import { SCENARIOS } from '../scenarios';
import type { ObjectiveSpec } from '../scenarios';
import type { MissionParams, Objective, ObjectiveKind } from '../types';
import { pushFx } from './sim';
import type { Sim, System } from './sim';
import { finishTasks, maintainTasks } from './tasks/maintenance';

function resolveTarget(spec: ObjectiveSpec, params: MissionParams): number {
  const base =
    spec.target === 'quota'
      ? params.quota
      : spec.target === 'deep'
        ? params.deepQuota
        : spec.target === 'kits'
          ? params.kits
          : spec.target;
  return Math.max(spec.min ?? 0, base - (spec.minus ?? 0));
}

export function buildObjectives(params: MissionParams): Objective[] {
  const out: Objective[] = [];
  for (const spec of SCENARIOS[params.scenario].objectives) {
    const target = resolveTarget(spec, params);
    if (target > 0)
      out.push({
        id: spec.kind,
        kind: spec.kind,
        primary: spec.primary,
        target,
        progress: 0,
        state: 'active',
      });
  }
  return out;
}

/** Objectives that can only be judged at liftoff. */
const AT_END: ReadonlySet<ObjectiveKind> = new Set<ObjectiveKind>(['repair_all', 'all_aboard']);

function value(sim: Sim, kind: ObjectiveKind): number {
  const s = sim.hidden.stats;
  switch (kind) {
    case 'deliver':
      return s.samplesDeposited;
    case 'deliver_deep':
      return s.deepDeposited;
    case 'deploy_stations':
      return s.stationsDeployed;
    case 'locate_signal':
      return sim.pub.signal.located ? 1 : 0;
    case 'retrieve_signal':
      return sim.pub.signal.retrieved ? 1 : 0;
    case 'discover':
      return s.discoveries;
    case 'classify':
      return s.classifyCorrect;
    case 'repair_all':
      return sim.pub.lander.faults.length === 0 ? 1 : 0;
    case 'all_aboard':
      return s.lost === 0 ? 1 : 0;
  }
}

function update(sim: Sim, final: boolean): void {
  for (const o of sim.pub.objectives) {
    if (o.state !== 'active') continue;
    if (AT_END.has(o.kind) && !final) continue;
    o.progress = Math.min(o.target, value(sim, o.kind));
    if (o.progress >= o.target) {
      o.state = 'done';
      pushFx(sim, { type: 'objective_done', s: o.id });
    } else if (final) o.state = 'failed';
  }
}

export const objectivesSystem: System = (sim) => {
  if (sim.pub.t >= 0 && !sim.pub.ended) {
    maintainTasks(sim);
    update(sim, false);
  }
};

/** Called by endMission after the final crew status is known. */
export function finalizeObjectives(sim: Sim): void {
  update(sim, true);
  finishTasks(sim);
}

/** Success = someone survived and every primary objective is done. */
export function primariesDone(objectives: Objective[]): boolean {
  return objectives.filter((o) => o.primary).every((o) => o.state === 'done');
}
