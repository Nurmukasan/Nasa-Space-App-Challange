// Dust devils and terrain multipliers (docs/product-logic.md 7.1, 7.14).
import { DEVIL, SAND, WORLD_PX } from '../balance';
import { createRng, hashString } from '../rng';
import { sandAt } from '../terrain';
import type { EvaState, Vec2 } from '../types';
import { clearFault } from './faults';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

/** o2 is a multiplier; o2Extra is additive so idle/running costs stay physically consistent. */
export function terrainMul(
  state: EvaState,
  salt: number,
  x: number,
  y: number,
): { speed: number; o2: number; o2Extra: number } {
  if (state.scenario === 'free') return { speed: 1, o2: 1, o2Extra: 0 };
  const sand = sandAt(x, y, salt);
  const devil = state.devils.some((d) => state.t < d.until && dist(x, y, d.x, d.y) <= d.r);
  return {
    speed: (sand ? SAND.speedMul : 1) * (devil ? DEVIL.speedMul : 1),
    o2: sand ? SAND.o2Mul : 1,
    o2Extra: devil ? DEVIL.o2Extra : 0,
  };
}

/** Each spawn has its own deterministic stream; no long-lived RNG or wall clock. */
export function spawnDevil(sim: Sim, near: Vec2): void {
  if (
    sim.params.scenario === 'free' ||
    sim.pub.t < 0 ||
    sim.pub.weather.light < DEVIL.minLight ||
    sim.pub.ended
  )
    return;
  const id = `D${sim.pub.tick}-${sim.pub.devils.length}`;
  const rng = createRng(sim.params.seed ^ 0xde7 ^ hashString(id));
  const angle = rng.range(0, Math.PI * 2),
    distance = rng.range(DEVIL.spawnMin, DEVIL.spawnMax);
  const r = rng.range(DEVIL.rMin, DEVIL.rMax),
    speed = rng.range(DEVIL.speedMin, DEVIL.speedMax);
  const x = Math.max(r, Math.min(WORLD_PX - r, near.x + Math.cos(angle) * distance));
  const y = Math.max(r, Math.min(WORLD_PX - r, near.y + Math.sin(angle) * distance));
  const heading = Math.atan2(near.y - y, near.x - x);
  sim.pub.devils.push({
    id,
    x,
    y,
    r,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    until: sim.pub.t + rng.range(DEVIL.lifeMin, DEVIL.lifeMax),
  });
  pushFx(sim, { type: 'devil', x, y, s: id });
}

export const devilSystem: System = (sim, dt) => {
  if (sim.params.scenario === 'free' || sim.pub.t < 0) return;
  if (sim.pub.weather.light < DEVIL.minLight) {
    sim.pub.devils = [];
    return;
  }
  sim.pub.devils = sim.pub.devils.filter((d) => sim.pub.t < d.until);
  for (const d of sim.pub.devils) {
    const phase = (hashString(d.id) / 0xffffffff) * Math.PI * 2;
    const turn = Math.sin(sim.pub.t * DEVIL.turnRate + phase) * DEVIL.turnRate * dt;
    const cos = Math.cos(turn),
      sin = Math.sin(turn),
      vx = d.vx;
    d.vx = vx * cos - d.vy * sin;
    d.vy = vx * sin + d.vy * cos;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.x < d.r) {
      d.x = d.r;
      d.vx = Math.abs(d.vx);
    }
    if (d.x > WORLD_PX - d.r) {
      d.x = WORLD_PX - d.r;
      d.vx = -Math.abs(d.vx);
    }
    if (d.y < d.r) {
      d.y = d.r;
      d.vy = Math.abs(d.vy);
    }
    if (d.y > WORLD_PX - d.r) {
      d.y = WORLD_PX - d.r;
      d.vy = -Math.abs(d.vy);
    }
    if (
      dist(d.x, d.y, sim.pub.lander.x, sim.pub.lander.y) <= DEVIL.cleanDist &&
      sim.pub.lander.faults.some((f) => f.kind === 'panel_dust')
    ) {
      clearFault(sim, 'panel_dust');
      // Do not claim cleaning if the A7 hook has not removed the fault yet.
      if (!sim.pub.lander.faults.some((f) => f.kind === 'panel_dust')) {
        pushFx(sim, { type: 'panel_clean', x: sim.pub.lander.x, y: sim.pub.lander.y });
        pushLog(sim, 'tulpar', 'log.panel_clean');
      }
    }
  }
};
