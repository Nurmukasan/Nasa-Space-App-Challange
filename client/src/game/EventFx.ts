import Phaser from 'phaser';
import type { EvaState, FxEvent } from '@rs/shared';
import { fxBus } from '../fx/FxBus';
import { prefs } from '../state/prefs';
import { FIELD } from './style';
import { EVENT_FX } from './eventStyle';

/** Tuning for the big world events. Visual only, gameplay lives in @rs/shared. */

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
        maxParticles: EVENT_FX.stormAlive,
      })
      .setScrollFactor(0)
      .setDepth(EVENT_FX.stormDepth);
    this.debris = scene.add
      .particles(0, 0, 'fx_spark', {
        emitting: false,
        lifespan: { min: 700, max: 1700 },
        speed: { min: 40, max: 170 },
        gravityY: 120,
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [EVENT_FX.colors.hot, EVENT_FX.colors.orange, FIELD.gold],
        maxAliveParticles: FIELD.eventDebris,
        maxParticles: FIELD.eventDebris,
      })
      .setDepth(EVENT_FX.depth);
    this.puffs = scene.add
      .particles(0, 0, 'fx_dust', {
        emitting: false,
        lifespan: { min: 1100, max: 2800 },
        speed: { min: 4, max: 26 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.55, end: 0 },
        tint: EVENT_FX.colors.dust,
        maxAliveParticles: FIELD.eventPuffs,
        maxParticles: FIELD.eventPuffs,
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
    if (this.reduce) {
      this.stormDust.killAll();
      this.debris.killAll();
      this.puffs.killAll();
      return;
    }
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
    const pillar = this.scene.add
      .rectangle(x, y - cfg.pillarH / 2, cfg.pillarW, cfg.pillarH, EVENT_FX.colors.hot, 0.9)
      .setDepth(EVENT_FX.depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: pillar,
      scaleX: 0.2,
      alpha: 0,
      duration: cfg.pillarMs,
      onComplete: () => pillar.destroy(),
    });
    this.scene.time.delayedCall(cfg.secondRingDelayMs, () => {
      if (this.reduce) return;
      const ring2 = this.scene.add
        .circle(x, y, cfg.ringStartPx)
        .setStrokeStyle(2, EVENT_FX.colors.orange, 0.9)
        .setDepth(EVENT_FX.depth);
      this.scene.tweens.add({
        targets: ring2,
        scale: cfg.ringEndScale * 1.4,
        alpha: 0,
        duration: cfg.ringMs * 1.2,
        ease: 'Cubic.easeOut',
        onComplete: () => ring2.destroy(),
      });
    });
    const crater = this.scene.add
      .circle(x, y, cfg.craterPx, EVENT_FX.colors.orange, 0.5)
      .setDepth(-39)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: crater,
      alpha: 0.12,
      yoyo: true,
      repeat: cfg.craterPulses,
      duration: cfg.craterMs / (cfg.craterPulses * 2 + 2),
      onComplete: () => crater.destroy(),
    });
    this.debris.emitParticleAt(x, y, cfg.debris);
    this.puffs.emitParticleAt(x, y, cfg.debris / 2);
    this.scene.time.delayedCall(cfg.columnDelayMs, () => {
      if (!this.reduce) this.puffs.emitParticleAt(x, y - 6, cfg.column);
    });
    this.scene.cameras.main.flash(160, 255, 240, 200, false);
  }

  private fireball(e: FxEvent): void {
    if (this.reduce) return;
    const { x = 0, y = 0 } = e;
    const cfg = EVENT_FX.fireball;
    const head = { x: x + cfg.fromX, y: y + cfg.fromY };
    let lastTrail = 0;
    const glow = this.scene.add
      .circle(head.x, head.y, cfg.headPx, EVENT_FX.colors.hot, 1)
      .setDepth(EVENT_FX.depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: head,
      x,
      y,
      duration: cfg.ms,
      onComplete: () => glow.destroy(),
      onUpdate: (tween) => {
        glow.setPosition(head.x, head.y);
        const now = tween.elapsed;
        if (now - lastTrail < cfg.trailEveryMs) return;
        lastTrail = now;
        this.debris.emitParticleAt(head.x, head.y, cfg.trailCount);
        this.puffs.emitParticleAt(head.x, head.y, 1);
      },
    });
  }

  private rockfall(e: FxEvent): void {
    const { x = 0, y = 0 } = e;
    const cfg = EVENT_FX.rockfall;
    if (this.reduce) {
      return;
    }
    for (let i = 0; i < cfg.rocks; i++) {
      const rx = x + Phaser.Math.Between(-cfg.spreadPx, cfg.spreadPx);
      const size = Phaser.Math.Between(3, 6);
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
          if (!this.reduce) this.puffs.emitParticleAt(rock.x, rock.y, 2);
          rock.destroy();
        },
      });
    }
    this.puffs.emitParticleAt(x, y, cfg.dust);
    this.scene.time.delayedCall(cfg.fallMs + cfg.rocks * 20, () => {
      if (this.reduce) return;
      const ring = this.scene.add
        .circle(x, y, cfg.ringPx)
        .setStrokeStyle(2, EVENT_FX.colors.dust, 0.9)
        .setDepth(EVENT_FX.depth);
      this.scene.tweens.add({
        targets: ring,
        scale: cfg.ringScale,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    });
  }

  /** The tremor has no position for the viewer, so dust lifts from the ground all around. */
  private tremor(): void {
    if (this.reduce) return;
    const cfg = EVENT_FX.tremor;
    const cam = this.scene.cameras.main;
    const cx = cam.scrollX + cam.width / 2,
      cy = cam.scrollY + cam.height / 2;
    const cracks = this.scene.add.graphics().setDepth(EVENT_FX.depth - 2);
    cracks.lineStyle(2, 0x1c0d0c, 0.85);
    for (let c = 0; c < cfg.cracks; c++) {
      let px = cx + Phaser.Math.Between(-cfg.viewPx, cfg.viewPx);
      let py = cy + Phaser.Math.Between(-cfg.viewPx / 2, cfg.viewPx / 2);
      let dir = Phaser.Math.FloatBetween(0, Math.PI * 2);
      cracks.beginPath();
      cracks.moveTo(px, py);
      for (let k = 0; k < cfg.crackSegs; k++) {
        dir += Phaser.Math.FloatBetween(-0.7, 0.7);
        px += Math.cos(dir) * cfg.crackStepPx;
        py += Math.sin(dir) * cfg.crackStepPx;
        cracks.lineTo(px, py);
      }
      cracks.strokePath();
    }
    this.scene.tweens.add({
      targets: cracks,
      alpha: 0,
      duration: cfg.crackMs,
      onComplete: () => cracks.destroy(),
    });
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
