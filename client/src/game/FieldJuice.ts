import type Phaser from 'phaser';
import { DIG, WORLD_PX } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { fxBus } from '../fx/FxBus';
import { prefs } from '../state/prefs';
import { FIELD } from './style';

/** Two bounded particle pools, one persistent track texture, one progress ring. */
export class FieldJuice {
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private tracks: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private lastStep = new Map<string, number>();
  private lastDig = new Map<string, number>();
  private trackCount = 0;
  constructor(private scene: Phaser.Scene) {
    this.tracks = scene.add.renderTexture(0, 0, WORLD_PX, WORLD_PX).setOrigin(0).setDepth(-50);
    this.stamp = scene.make
      .image({ key: 'fx_dust', add: false })
      .setTint(0x1a0c10)
      .setAlpha(0.6)
      .setScale(0.42, 0.22);
    this.dust = scene.add
      .particles(0, 0, 'fx_dust', {
        emitting: false,
        lifespan: 450,
        speed: { min: 4, max: 18 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.45, end: 0 },
        maxParticles: FIELD.juiceParticles / 2,
        maxAliveParticles: FIELD.juiceParticles / 2,
      })
      .setDepth(700);
    this.spark = scene.add
      .particles(0, 0, 'fx_spark', {
        emitting: false,
        lifespan: 500,
        speed: { min: 12, max: 35 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: FIELD.gold,
        maxParticles: FIELD.juiceParticles / 2,
        maxAliveParticles: FIELD.juiceParticles / 2,
      })
      .setDepth(1400);
    const off = fxBus.on('sample', (event) => {
      if (!prefs.getState().reduceMotion) this.spark.emitParticleAt(event.x, event.y, 8);
    });
    const cleanup = () => {
      scene.events.off('shutdown', cleanup);
      scene.events.off('destroy', cleanup);
      off();
      this.stamp.destroy();
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
  }
  update(snap: EvaState, id: string, x: number, y: number, time: number): void {
    const reduce = prefs.getState().reduceMotion;
    if (reduce) {
      this.dust.killAll();
      this.spark.killAll();
    }
    let own = snap.astronauts[0];
    for (const a of snap.astronauts) {
      if (a.id === id) own = a;
      if (a.status !== 'active') continue;
      const ax = a.id === id ? x : a.x,
        ay = a.id === id ? y : a.y;
      if (a.moving && time - (this.lastStep.get(a.id) ?? 0) >= FIELD.stepMs) {
        this.lastStep.set(a.id, time);
        if (!reduce) this.dust.emitParticleAt(ax, ay + 5, 2);
        if (this.trackCount++ >= FIELD.maxTracks) {
          this.tracks.clear();
          this.trackCount = 0;
        }
        // Alternate left and right foot, offset sideways from the walking direction.
        const side = (this.trackCount & 1 ? 1 : -1) * FIELD.footOffsetPx;
        this.stamp.setRotation(a.facing);
        this.tracks.draw(
          this.stamp,
          Math.round(ax - Math.sin(a.facing) * side),
          Math.round(ay + 5 + Math.cos(a.facing) * side),
        );
      }
      if (a.digging && !reduce && time - (this.lastDig.get(a.id) ?? 0) >= FIELD.digParticleMs) {
        this.lastDig.set(a.id, time);
        this.dust.emitParticleAt(ax + 7, ay + 5, 4);
      }
    }
    this.scene.registry.set(
      'juiceParticles',
      this.dust.getAliveParticleCount() + this.spark.getAliveParticleCount(),
    );
  }
}
