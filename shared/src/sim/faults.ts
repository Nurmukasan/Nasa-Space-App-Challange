// Lander faults and repairs at service ports (docs/product-logic.md 7.16).
// Mission Control sees which hatch; the crew repairs it by standing there (E starts the job).
import { CREW, FAULTS, LANDER_POS, O2 } from '../balance';
import type { Astronaut, Fault, FaultKind, ServicePort, Vec2 } from '../types';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

const DIRS: Record<ServicePort, Vec2> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

/** World position of a service port. Shared with the client (field hatches, SEND TO PORT). */
export function portPos(port: ServicePort): Vec2 {
  const d = DIRS[port];
  return { x: LANDER_POS.x + d.x * FAULTS.portDist, y: LANDER_POS.y + d.y * FAULTS.portDist };
}

/** Director/beat hook: break a lander system (ignored if already broken or at the limit). */
export function spawnFault(sim: Sim, kind: FaultKind): void {
  const faults = sim.pub.lander.faults;
  if (faults.length >= FAULTS.maxActive || faultActive(sim, kind)) return;
  if (kind === 'battery_fault' && !sim.params.hasBattery) return;
  const fault: Fault = {
    id: `F${sim.hidden.nextFxId}`,
    kind,
    port: FAULTS.ports[kind],
    since: sim.pub.t,
    progress: 0,
  };
  faults.push(fault);
  pushFx(sim, { type: 'fault', s: kind });
  pushLog(sim, 'tulpar', `log.fault.${kind}`);
}

/** Remove a fault without a repair (a dust devil cleaning the panels). */
export function clearFault(sim: Sim, kind: FaultKind): void {
  const lander = sim.pub.lander;
  const fault = lander.faults.find((f) => f.kind === kind);
  if (!fault) return;
  lander.faults = lander.faults.filter((f) => f !== fault);
  for (const a of sim.pub.astronauts) if (a.repairing === fault.id) a.repairing = null;
}

export function faultActive(sim: Sim, kind: FaultKind): boolean {
  return sim.pub.lander.faults.some((f) => f.kind === kind);
}

function faultAt(sim: Sim, a: Astronaut): Fault | undefined {
  return sim.pub.lander.faults.find((f) => {
    const p = portPos(f.port);
    return dist(a.x, a.y, p.x, p.y) <= FAULTS.portRadius;
  });
}

/** E-key step 4: start repairing the fault at this port. Returns true if the key press was used. */
export function tryStartRepair(sim: Sim, a: Astronaut): boolean {
  const fault = faultAt(sim, a);
  if (!fault) return false;
  a.repairing = fault.id;
  a.digging = false;
  return true;
}

export const faultSystem: System = (sim, dt) => {
  if (sim.pub.t < 0) return;
  const lander = sim.pub.lander;
  if (lander.faults.length > 0) sim.hidden.stats.faultSeconds += dt;
  const worked = new Set<string>();
  for (const a of sim.pub.astronauts) {
    if (!a.repairing) continue;
    const fault = lander.faults.find((f) => f.id === a.repairing);
    // Walking away pauses the job; progress stays on the fault.
    if (!fault || a.status !== 'active' || a.moving || faultAt(sim, a) !== fault) {
      a.repairing = null;
      continue;
    }
    // Repair work breathes like digging (the oxygen system already charged the idle rate).
    a.o2 = Math.max(0, a.o2 - (O2.dig - O2.idle) * dt);
    if (worked.has(fault.id)) continue; // a second astronaut does not speed it up
    worked.add(fault.id);
    fault.progress = Math.min(
      1,
      fault.progress + (dt * CREW.repairMul[a.crewClass]) / FAULTS.repairS,
    );
    if (fault.progress < 1) continue;
    lander.faults = lander.faults.filter((f) => f !== fault);
    for (const b of sim.pub.astronauts) if (b.repairing === fault.id) b.repairing = null;
    sim.hidden.stats.repairs++;
    const crew = sim.hidden.stats.crewStats.find((c) => c.id === a.id);
    if (crew) crew.repairs++;
    pushFx(sim, { type: 'repair_done', playerId: a.id, s: fault.kind });
    pushLog(sim, a.id, `log.repaired.${fault.kind}`);
  }
};
