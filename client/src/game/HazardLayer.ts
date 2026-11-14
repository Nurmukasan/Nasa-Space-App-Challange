import type Phaser from 'phaser';
import { LANDER_POS, VIEW_H, VIEW_W, hashString } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { prefs } from '../state/prefs';
import { FIELD } from './style';

/** Persistent graphics and a bounded dust pool; no per-frame game-object allocation. */
export class HazardLayer {
  private devils = new Map<string, Phaser.GameObjects.Sprite>();
  private ice = new Map<string, Phaser.GameObjects.Image>();
  private zones: Phaser.GameObjects.Graphics;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private nextDustAt = 0;
  constructor(private scene: Phaser.Scene) {
    this.zones = scene.add.graphics().setDepth(860);
    this.dust = scene.add
      .particles(0, 0, 'fx_dust', {
        emitting: false,
        lifespan: FIELD.hazardLifeMs,
        speed: { min: 8, max: 26 },
        angle: { min: 180, max: 350 },
        scale: { start: 0.4, end: 1.2 },
        alpha: { start: 0.35, end: 0 },
        tint: [0xd8a77f, 0xb47d65],
        maxParticles: FIELD.hazardParticles,
        maxAliveParticles: FIELD.hazardParticles,
      })
      .setDepth(880);
  }
  update(snap: EvaState, now: number): void {
    const reduce = prefs.getState().reduceMotion;
    this.zones.clear();
    const ids = new Set(snap.devils.map((d) => d.id));
    for (const [id, sprite] of this.devils)
      if (!ids.has(id)) {
        sprite.destroy();
        this.devils.delete(id);
      }
    for (const d of snap.devils) {
      let sprite = this.devils.get(d.id);
      if (!sprite) {
        sprite = this.scene.add.sprite(d.x, d.y, 'devil').setOrigin(0.5, 0.8);
        this.devils.set(d.id, sprite);
      }
      sprite
        .setPosition(d.x, d.y)
        .setDisplaySize(d.r * 2, d.r * 3)
        .setDepth(d.y + 1)
        .setFrame(reduce ? 0 : Math.floor(snap.t * 9) % 6)
        .setRotation(reduce ? 0 : Math.sin(snap.t * 2) * 0.08)
        .setAlpha(0.7);
    }
    for (const h of snap.hazards)
      if (h.warned && snap.t <= h.tHit) {
        this.zones.lineStyle(1, FIELD.danger, reduce ? 0.7 : 0.55 + Math.sin(snap.t * 6) * 0.2);
        this.zones.strokeCircle(h.x, h.y, h.r);
      }
    const ice = snap.sites.filter(
      (s) => s.kind === 'impact' && (s.expiresAt === null || snap.t < s.expiresAt),
    );
    const iceIds = new Set(ice.map((s) => s.id));
    for (const [id, sprite] of this.ice)
      if (!iceIds.has(id)) {
        sprite.destroy();
        this.ice.delete(id);
      }
    for (const site of ice) {
      if (!this.ice.has(site.id))
        this.ice.set(
          site.id,
          this.scene.add.image(site.x, site.y, 'crater_decal').setDepth(site.y - 2),
        );
      for (let i = 0; i < 4; i++) {
        const phase = hashString(site.id) + i * 2.4;
        const x = site.x + Math.cos(phase) * 14,
          y = site.y + Math.sin(phase) * 9;
        this.zones.lineStyle(
          1,
          0xd2f8ff,
          reduce ? 0.7 : 0.25 + (Math.sin(snap.t * 4 + phase) + 1) * 0.3,
        );
        this.zones.lineBetween(x - 2, y, x + 2, y);
        this.zones.lineBetween(x, y - 2, x, y + 2);
      }
    }
    if (reduce) this.dust.killAll();
    else if (now >= this.nextDustAt) {
      this.nextDustAt = now + FIELD.hazardEmitMs;
      for (const d of snap.devils)
        this.dust.emitParticleAt(d.x + Math.cos(snap.t * 5) * d.r, d.y - d.r, 1);
      if (snap.t < 0)
        this.dust.emitParticleAt(LANDER_POS.x + Math.sin(now / 100) * 25, LANDER_POS.y + 25, 3);
      const storm = snap.weather.storm;
      if (storm && snap.t >= storm.tStart && snap.t < storm.tEnd) {
        const cam = this.scene.cameras.main;
        for (let i = 0; i < 3; i++)
          this.dust.emitParticleAt(
            cam.scrollX + ((snap.tick * 37 + i * 91) % VIEW_W),
            cam.scrollY + ((snap.tick * 13 + i * 53) % VIEW_H),
            1,
          );
      }
    }
    this.scene.registry.set('hazardParticles', this.dust.getAliveParticleCount());
  }
}
