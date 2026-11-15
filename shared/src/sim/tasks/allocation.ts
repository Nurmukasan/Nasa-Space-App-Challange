import { CREW, DIG, O2, RETURN, SAND, STATIONS, TASKS } from '../../balance';
import { createRng } from '../../rng';
import { TASK_CHAINS } from '../../scenarios/taskChains';
import type { TaskChain } from '../../scenarios/taskChains';
import { sandAt } from '../../terrain';
import type { PersonalTask, SampleSite, TaskCrew, TaskTarget } from '../../types';
import { dist } from '../sim';
import type { Sim } from '../sim';

/** Conservative walking round trip, sand and digging; no reliance on the single rover. */
export function reachable(sim: Sim, target: TaskTarget, crew: TaskCrew): boolean {
  const p = sim.params;
  const d = dist(target.x, target.y, sim.pub.lander.x, sim.pub.lander.y) + (target.r ?? 0);
  const depth = target.tier === 'deep' ? DIG.deepDepth : DIG.surfaceDepth;
  const digging = (depth / (p.digRate * CREW.digMul[crew.crewClass])) * O2.dig;
  const travel =
    (2 * d * SAND.o2Mul * TASKS.travelMargin) /
    (p.walkSpeed * SAND.speedMul * CREW.speedMul[crew.crewClass]);
  return (
    d <= TASKS.maxRange &&
    travel + digging + RETURN.reserve < p.tankCapacity * TASKS.tankFraction &&
    travel / O2.walk + digging / O2.dig + TASKS.returnReserveS <
      sim.pub.durationS - Math.max(0, sim.pub.t)
  );
}

function targetOf(site: SampleSite, deep = false): TaskTarget {
  return { id: site.id, x: site.x, y: site.y, tier: deep ? 'deep' : 'surface' };
}

function reserved(sim: Sim, exceptOwner?: string): Set<string> {
  return new Set(
    (sim.pub.taskBoard?.tasks ?? [])
      .filter((t) => t.ownerId !== exceptOwner && t.kind !== 'guide' && t.target)
      .map((t) => `${t.target!.id}:${t.target!.tier ?? 'surface'}`),
  );
}

export function sampleTarget(
  sim: Sim,
  crew: TaskCrew,
  variant = 0,
  deep = false,
): TaskTarget | undefined {
  const used = reserved(sim, crew.id);
  const candidates = sim.pub.sites
    .filter((s) => s.known && s.kind !== 'signal' && s.expiresAt === null)
    .map((s) => ({ site: s, target: targetOf(s, deep) }))
    .filter(
      ({ site, target }) =>
        !used.has(`${site.id}:${target.tier}`) &&
        !site.taken.includes(target.tier!) &&
        reachable(sim, target, crew),
    );
  return candidates.length ? candidates[variant % candidates.length]!.target : undefined;
}

function deploymentTarget(sim: Sim, index: number): TaskTarget | undefined {
  for (let i = 0; i < TASKS.stationAngles; i++) {
    const angle = ((i + index) * Math.PI * 2) / TASKS.stationAngles;
    const x = Math.round(sim.pub.lander.x + Math.cos(angle) * TASKS.stationRadius);
    const y = Math.round(sim.pub.lander.y + Math.sin(angle) * TASKS.stationRadius);
    if (
      !sandAt(x, y, sim.salt) &&
      sim.pub.stations.every((s) => dist(x, y, s.x, s.y) >= STATIONS.minBetween) &&
      (sim.pub.taskBoard?.tasks ?? []).every(
        (t) =>
          t.kind !== 'deploy' ||
          !t.target ||
          dist(x, y, t.target.x, t.target.y) >= STATIONS.minBetween,
      )
    )
      return { id: `station-${index}`, x, y };
  }
  return undefined;
}

function preferredTarget(sim: Sim, crew: TaskCrew, variant: number): TaskTarget | undefined {
  const target = sampleTarget(sim, crew, variant);
  const candidates = sim.pub.sites.filter((s) => s.kind === sim.params.favoredKind);
  for (const site of candidates) {
    const candidate = targetOf(site);
    if (
      site.known &&
      !site.taken.includes('surface') &&
      !reserved(sim, crew.id).has(`${site.id}:surface`) &&
      reachable(sim, candidate, crew)
    )
      return candidate;
  }
  return target;
}

function chain(
  sim: Sim,
  crew: TaskCrew,
  kind: TaskChain,
  variant: number,
): [PersonalTask['kind'], TaskTarget, TaskTarget] | undefined {
  const sample = sampleTarget(sim, crew, variant, kind === 'deep');
  if (kind === 'deep' && sim.params.maxDepth < DIG.deepDepth + DIG.thresholdEpsilon)
    return undefined;
  if (!sample) return undefined;
  if (kind === 'deploy') {
    const astronaut = sim.pub.astronauts.find((a) => a.id === crew.id);
    const target = astronaut?.kits ? deploymentTarget(sim, variant) : undefined;
    return target && reachable(sim, target, crew) ? ['deploy', target, sample] : undefined;
  }
  if (kind === 'survey' && sim.params.scenario === 'signal') {
    const used = reserved(sim, crew.id);
    const candidates = sim.pub.anomalies.filter(
      (a) => !used.has(`${a.id}:surface`) && reachable(sim, { ...a, tier: 'surface' }, crew),
    );
    const anomaly = candidates[variant % candidates.length];
    if (anomaly) {
      const target = {
        id: anomaly.id,
        x: anomaly.x,
        y: anomaly.y,
        r: anomaly.r,
        tier: 'surface' as const,
      };
      return ['discover', target, { ...target }];
    }
    return undefined;
  }
  if (kind === 'survey') return undefined;
  const chosen = kind === 'preferred' ? preferredTarget(sim, crew, variant)! : sample;
  return ['collect', chosen, { ...chosen }];
}

export function initTaskBoard(sim: Sim, roster: TaskCrew[], attempt: number): void {
  if (sim.params.scenario === 'free') return;
  sim.pub.taskBoard = { crew: roster.map((p) => ({ ...p })), tasks: [] };
  sim.hidden.tasks = { disconnectedAt: {}, routes: {}, decisions: 0 };
  const rng = createRng(sim.params.seed ^ TASKS.rngSalt ^ Math.imul(attempt, TASKS.attemptSalt));
  // Allocate field opportunities first; MC can refer to their public destinations.
  for (const crew of roster.filter((p) => p.role !== 'mc')) {
    const variant = rng.int(0, TASKS.stationAngles - 1);
    const pool = TASK_CHAINS[crew.crewClass];
    const start = rng.int(0, pool.length - 1);
    const options = [...pool.slice(start), ...pool.slice(0, start), 'sampling' as const];
    const selected = options.map((kind) => chain(sim, crew, kind, variant)).find(Boolean);
    const firstId = `task-${roster.indexOf(crew)}-0`;
    const common = { originalOwnerId: crew.id, ownerId: crew.id };
    sim.pub.taskBoard.tasks.push(
      {
        ...common,
        id: firstId,
        kind: selected?.[0] ?? 'collect',
        state: selected ? 'active' : 'blocked',
        target: selected?.[1],
        ...(selected ? {} : { reason: 'no_work' as const }),
      },
      {
        ...common,
        id: `task-${roster.indexOf(crew)}-1`,
        after: firstId,
        kind: 'deliver',
        state: 'queued',
        target: selected?.[2],
      },
    );
  }
  for (const crew of roster.filter((p) => p.role === 'mc')) {
    const field = sim.pub.taskBoard.tasks.find((t) => t.state === 'active' && t.target);
    const common = { originalOwnerId: crew.id, ownerId: crew.id };
    const firstId = `task-${roster.indexOf(crew)}-0`;
    sim.pub.taskBoard.tasks.push(
      {
        ...common,
        id: firstId,
        kind: 'guide',
        state: field ? 'active' : 'blocked',
        target: field?.target ? { ...field.target, playerId: field.ownerId } : undefined,
      },
      {
        ...common,
        id: `task-${roster.indexOf(crew)}-1`,
        after: firstId,
        kind: 'observe',
        state: 'queued',
      },
    );
  }
  sim.pub.taskBoard.tasks.sort(
    (a, b) =>
      roster.findIndex((p) => p.id === a.originalOwnerId) -
        roster.findIndex((p) => p.id === b.originalOwnerId) || a.id.localeCompare(b.id),
  );
}
