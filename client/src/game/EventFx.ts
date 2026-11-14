import Phaser from 'phaser';
import type { EvaState, FxEvent } from '@rs/shared';
import { fxBus } from '../fx/FxBus';
import { prefs } from '../state/prefs';
import { FIELD } from './style';

/** Tuning for the big world events. Visual only, gameplay lives in @rs/shared. */
const EVENT_FX = {
  /** Depth above terrain and crew, below the lighting layer. */
  depth: 1300,
  stormDepth: 908,
  stormRampS: 3,
  stormMaxPerFrame: 6,
  stormSpeed: { min: 520, max: 900 },
  stormLifeMs: 900,
  stormAlive: 320,
  impact: {
    ringStartPx: 6,
    ringEndScale: 9,
    ringMs: 650,
    flashPx: 26,
    flashMs: 260,
    debris: 26,
    scorchPx: 22,
    scorchAlpha: 0.55,
    scorchMs: 20000,
    shockPx: 70,
  },
  fireball: { fromX: -200, fromY: -130, ms: 750, trailEveryMs: 28, trailCount: 2 },
  rockfall: { rocks: 7, spreadPx: 14, heightPx: 60, fallMs: 320, dust: 10 },
  tremor: { puffs: 14, viewPx: 220, ms: 1200 },
  colors: { hot: 0xfff0c8, orange: 0xff8a30, rock: 0x5b3a34, rockLight: 0x9a6a56, dust: 0xe8b890 },
};

/**
 * Big, readable effects for world events: dust storm streaks, impact shockwave and scorch,
 * fireball trail, rockfall debris and tremor puffs. All pools are bounded; reduced motion
 * keeps only a quick fade so nothing flashes or shakes.
 */
export class EventFx {
  private stormDust: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private puffs: Phaser.GameObjects.Particles.ParticleEmitter;
  private off: Array<() => void> = [];

  constructor(private scene: Phaser.Scene) {
    this.stormDust = scene.add
      .particles(0, 0, 'fx_dust', {
        emitting: false,
        lifespan: EVENT_FX.stormLifeMs,
        speedX: EVENT_FX.stormSpeed,
        speedY: { min: 40, max: 160 },
        scaleX: { start: 12, end: 5 },
        scaleY: { start: 0.7, end: 0.35 },
        alpha: { start: 0.75, end: 0 },
        tint: EVENT_FX.colors.dust,
        maxAliveParticles: EVENT_FX.stormAlive,
      })
      .setScrollFactor(0)
      .setDepth(EVENT_FX.stormDepth);
    this.debris = scene.add
      .particles(0, 0, 'fx_spark', {
        emitting: false,
        lifespan: { min: 350, max: 800 },
        speed: { min: 40, max: 170 },
        gravityY: 120,
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [EVENT_FX.colors.hot, EVENT_FX.colors.orange, FIELD.gold],
        maxAliveParticles: FIELD.maxParticles,
      })
      .setDepth(EVENT_FX.depth);
    this.puffs = scene.add
      .particles(0, 0, 'fx_dust', {
        emitting: false,
        lifespan: { min: 500, max: 1100 },
        speed: { min: 4, max: 26 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.55, end: 0 },
        tint: EVENT_FX.colors.dust,
        maxAliveParticles: FIELD.maxParticles,
      })
      .setDepth(EVENT_FX.depth - 1);
    this.off.push(
      fxBus.on('impact', (e) => this.impact(e)),
      fxBus.on('fireball', (e) => this.fireball(e)),
      fxBus.on('rockfall', (e) => this.rockfall(e)),
      fxBus.on('tremor', () => this.tremor()),
    );
    const cleanup = () => {
      scene.events.off('shutdown', cleanup);
      scene.events.off('destroy', cleanup);
      for (const off of this.off) off();
      this.off.length = 0;
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
  }

  private get reduce(): boolean {
    return prefs.getState().reduceMotion;
  }

  /** Per frame: dust streaks fly across the screen while a storm is active. */
  update(snap: EvaState): void {
    const storm = snap.weather.storm;
    if (!storm || this.reduce || snap.t < storm.tStart || snap.t >= storm.tEnd) return;
    const ramp = EVENT_FX.stormRampS;
    const level = Math.min(1, (snap.t - storm.tStart) / ramp, (storm.tEnd - snap.t) / ramp);
    const view = this.scene.cameras.main;
    const count = Math.round(level * EVENT_FX.stormMaxPerFrame);
    for (let i = 0; i < count; i++)
      this.stormDust.emitParticleAt(-20, Math.random() * view.height, 1);
  }

  private impact(e: FxEvent): void {
    const { x = 0, y = 0 } = e;
    const cfg = EVENT_FX.impact;
    const scorch = this.scene.add
      .circle(x, y, cfg.scorchPx, 0x1c0e14, cfg.scorchAlpha)
      .setDepth(-40);
    this.scene.tweens.add({
      targets: scorch,
      alpha: 0,
      duration: cfg.scorchMs,
      onComplete: () => scorch.destroy(),
    });
    if (this.reduce) return;
    const flash = this.scene.add
      .circle(x, y, cfg.flashPx, EVENT_FX.colors.hot, 1)
      .setDepth(EVENT_FX.depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: flash,
      scale: 2.4,
      alpha: 0,
      duration: cfg.flashMs,
      onComplete: () => flash.destroy(),
    });
    const ring = this.scene.add
      .circle(x, y, cfg.ringStartPx)
      .setStrokeStyle(3, EVENT_FX.colors.hot, 1)
      .setFillStyle(EVENT_FX.colors.orange, 0)
      .setDepth(EVENT_FX.depth);
    this.scene.tweens.add({
      targets: ring,
      scale: cfg.ringEndScale,
      alpha: 0,
      duration: cfg.ringMs,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.debris.emitParticleAt(x, y, cfg.debris);
    this.puffs.emitParticleAt(x, y, cfg.debris / 2);
    this.scene.cameras.main.flash(160, 255, 240, 200, false);
  }

  private fireball(e: FxEvent): void {
    if (this.reduce) return;
    const { x = 0, y = 0 } = e;
    const cfg = EVENT_FX.fireball;
    const head = { x: x + cfg.fromX, y: y + cfg.fromY };
    let lastTrail = 0;
    this.scene.tweens.add({
      targets: head,
      x,
      y,
      duration: cfg.ms,
      onUpdate: (tween) => {
        const now = tween.elapsed;
        if (now - lastTrail < cfg.trailEveryMs) return;
        lastTrail = now;
        this.debris.emitParticleAt(head.x, head.y, cfg.trailCount);
      },
    });
  }

  private rockfall(e: FxEvent): void {
    const { x = 0, y = 0 } = e;
    const cfg = EVENT_FX.rockfall;
    if (this.reduce) {
      this.puffs.emitParticleAt(x, y, 3);
      return;
    }
    for (let i = 0; i < cfg.rocks; i++) {
      const rx = x + Phaser.Math.Between(-cfg.spreadPx, cfg.spreadPx);
      const size = Phaser.Math.Between(2, 4);
      const rock = this.scene.add
        .rectangle(
          rx,
          y - cfg.heightPx - i * 6,
          size,
          size,
          i % 2 ? EVENT_FX.colors.rock : EVENT_FX.colors.rockLight,
        )
        .setDepth(EVENT_FX.depth);
      this.scene.tweens.add({
        targets: rock,
        y: y + Phaser.Math.Between(-4, 4),
        rotation: Phaser.Math.FloatBetween(-3, 3),
        duration: cfg.fallMs + i * 25,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.puffs.emitParticleAt(rock.x, rock.y, 2);
          rock.destroy();
        },
      });
    }
    this.puffs.emitParticleAt(x, y, cfg.dust);
  }

  /** The tremor has no position for the viewer, so dust lifts from the ground all around. */
  private tremor(): void {
    if (this.reduce) return;
    const cfg = EVENT_FX.tremor;
    const cam = this.scene.cameras.main;
    const cx = cam.scrollX + cam.width / 2,
      cy = cam.scrollY + cam.height / 2;
    for (let i = 0; i < cfg.puffs; i++)
      this.scene.time.delayedCall((i / cfg.puffs) * cfg.ms, () =>
        this.puffs.emitParticleAt(
          cx + Phaser.Math.Between(-cfg.viewPx, cfg.viewPx),
          cy + Phaser.Math.Between(-cfg.viewPx / 2, cfg.viewPx / 2),
          2,
        ),
      );
  }
}
