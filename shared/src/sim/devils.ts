// Dust devils and terrain multipliers (docs/product-logic.md 7.1, 7.14).
// Phase 0 stub (owner B, task B6).
import type { EvaState, Vec2 } from '../types';
import type { Sim, System } from './sim';

/** Speed and oxygen multipliers at a point (sand, dust devils). Shared by client and server. */
export function terrainMul(
  _state: EvaState,
  _salt: number,
  _x: number,
  _y: number,
): { speed: number; o2: number } {
  return { speed: 1, o2: 1 };
}

/** Director hook: spawn a dust devil near a point. */
export function spawnDevil(_sim: Sim, _near: Vec2): void {}

export const devilSystem: System = () => {};
