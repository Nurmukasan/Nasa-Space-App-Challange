import type Phaser from 'phaser';
import { LANDER_POS, O2, PROPS, WORLD_PX, createRng } from '@rs/shared';
import type { Vec2 } from '@rs/shared';

export interface Prop extends Vec2 {
  key: string;
}
/** Placement is visual only: it never changes terrain, movement or the simulation. */
export function generateProps(salt: number, sites: readonly Vec2[]): Prop[] {
  const rng = createRng(salt);
  const clear = (x: number, y: number): boolean =>
    Math.hypot(x - LANDER_POS.x, y - LANDER_POS.y) >= O2.airlockRadius + PROPS.clearance &&
    sites.every((s) => Math.hypot(x - s.x, y - s.y) >= PROPS.clearance);
  const props: Prop[] = [];
  function add(key: string): void {
    for (let i = 0; i < PROPS.attempts; i++) {
      const x = rng.int(PROPS.clearance, WORLD_PX - PROPS.clearance),
        y = rng.int(PROPS.clearance, WORLD_PX - PROPS.clearance);
      if (clear(x, y)) {
        props.push({ key, x, y });
        return;
      }
    }
  }
  const rocks = rng.int(PROPS.rockMin, PROPS.rockMax),
    boulders = rng.int(PROPS.boulderMin, PROPS.boulderMax);
  for (let i = 0; i < rocks; i++) add(`rock_${rng.int(1, 3)}`);
  for (let i = 0; i < boulders; i++) add(`boulder_${rng.int(1, 2)}`);
  for (let i = 0; i < PROPS.attempts; i++) {
    const angle = rng.range(0, Math.PI * 2),
      radius = rng.range(PROPS.debrisMinRadius, PROPS.debrisMaxRadius);
    const x = Math.round(LANDER_POS.x + Math.cos(angle) * radius),
      y = Math.round(LANDER_POS.y + Math.sin(angle) * radius);
    if (clear(x, y)) {
      props.push({ key: 'debris_chute', x, y });
      break;
    }
  }
  return props;
}
export class PropLayer {
  constructor(scene: Phaser.Scene, salt: number, sites: readonly Vec2[]) {
    const props = generateProps(salt, sites);
    // Bake static scenery once: adding props must not add dozens of per-frame draw objects.
    const layer = scene.add.renderTexture(0, 0, WORLD_PX, WORLD_PX).setOrigin(0).setDepth(-95);
    const stamp = scene.make.image({ key: 'rock_1', add: false });
    for (const p of props) {
      stamp.setTexture(p.key).setPosition(p.x, p.y);
      layer.draw(stamp);
    }
    stamp.destroy();
    scene.registry.set('propCount', props.length);
  }
}
