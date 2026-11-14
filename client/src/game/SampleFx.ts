import Phaser from 'phaser';
import { DIG } from '@rs/shared';
import type { EvaState, SampleTier, SampleSite } from '@rs/shared';
import { fxBus } from '../fx/FxBus';
import { prefs } from '../state/prefs';
import { snaps } from '../state/snapshots';
import { evaText as t } from '../i18n/en/eva';
import { FIELD } from './style';
import { worldLabels } from './WorldLabels';

const SAMPLE_FX = {
  depth: 1100,
  gaugeR: 17,
  spinnerR: 22,
  spinnerSegs: 10,
  spinnerRadPerMs: 0.0016,
  beamAlpha: 0.55,
  chipsEveryMs: 70,
  chips: 3,
  popPx: 20,
  popMs: 240,
  holdMs: 140,
  flyMs: 560,
  arcPx: 16,
  glintEveryMs: 900,
  glintRange: 7,
  maxGlintSites: 6,
  tiers: {
    surface: { color: 0xd9a066, frame: 0 },
    deep: { color: 0xff8a30, frame: 1 },
    core: { color: 0x50e6f0, frame: 2 },
  } as Record<SampleTier, { color: number; frame: number }>,
  kindTone: { delta: 0xd9a066, crater: 0xa86a4a, basalt: 0x6b6580, impact: 0xbfe6f5 } as Record<
    string,
    number
  >,
};
const THRESHOLDS: Array<[SampleTier, number]> = [
  ['surface', DIG.surfaceDepth],
  ['deep', DIG.deepDepth],
  ['core', DIG.coreDepth],
];

/**
 * Everything around collecting a sample: a drill gauge with a tier marker per layer, a scanner
 * beam to the site, flying dirt chips, a gem that pops out and flies to the astronaut, and a
 * slow glint on sites that still hold something.
 */
export class SampleFx {
  private gauge: Phaser.GameObjects.Graphics;
  private chips: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private off: Array<() => void> = [];
  private own = { x: 0, y: 0, id: '' };
  private lastChips = 0;
  private lastGlint = 0;

  constructor(private scene: Phaser.Scene) {
    this.gauge = scene.add.graphics().setDepth(SAMPLE_FX.depth);
    this.chips = scene.add
      .particles(0, 0, 'fx_spark', {
        emitting: false,
        lifespan: { min: 380, max: 760 },
        speed: { min: 30, max: 90 },
        angle: { min: 215, max: 325 },
        gravityY: 260,
        scale: { start: 0.7, end: 0.2 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        maxAliveParticles: FIELD.sampleChips,
        maxParticles: FIELD.sampleChips,
      })
      .setDepth(SAMPLE_FX.depth - 1);
    this.sparks = scene.add
      .particles(0, 0, 'fx_spark', {
        emitting: false,
        lifespan: { min: 300, max: 700 },
        speed: { min: 6, max: 40 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: FIELD.sampleSparks,
        maxParticles: FIELD.sampleSparks,
      })
      .setDepth(SAMPLE_FX.depth + 1);
    this.off.push(
      fxBus.on('sample', (e) => this.collected(e.playerId, e.x ?? 0, e.y ?? 0, e.n ?? 0)),
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

  private get still(): boolean {
    return prefs.getState().reduceMotion;
  }

  update(snap: EvaState, id: string, x: number, y: number, now: number, maxDepth: number): void {
    if (this.still) {
      this.chips.killAll();
      this.sparks.killAll();
    }
    this.own = { x, y, id };
    this.gauge.clear();
    const me = snap.astronauts.find((a) => a.id === id);
    const site = me?.digging
      ? snap.sites.find((s) => Math.hypot(s.x - me.x, s.y - me.y) <= DIG.reach)
      : undefined;
    if (site) this.drawGauge(site, x, y, now, Math.min(DIG.coreDepth, maxDepth));
    if (!this.still) this.glints(snap, now);
  }

  private drawGauge(site: SampleSite, px: number, py: number, now: number, maxDepth: number) {
    const g = this.gauge,
      still = this.still;
    const frac = Phaser.Math.Clamp(site.depth / maxDepth, 0, 1);
    const next = THRESHOLDS.find(([tier]) => !site.taken.includes(tier)) ?? THRESHOLDS[2]!;
    const color = SAMPLE_FX.tiers[next[0]].color;
    const r = SAMPLE_FX.gaugeR;
    g.lineStyle(3, 0x1c0d0c, 0.85);
    g.strokeCircle(site.x, site.y, r);
    g.lineStyle(3, color, 1);
    g.beginPath();
    g.arc(site.x, site.y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
    g.strokePath();
    for (const [tier, threshold] of THRESHOLDS) {
      if (threshold > maxDepth) continue;
      const a = -Math.PI / 2 + (threshold / maxDepth) * Math.PI * 2;
      const mx = site.x + Math.cos(a) * r,
        my = site.y + Math.sin(a) * r;
      const have = site.taken.includes(tier);
      g.fillStyle(have ? SAMPLE_FX.tiers[tier].color : 0x1c0d0c, 1);
      g.fillCircle(mx, my, 3);
      g.lineStyle(1, SAMPLE_FX.tiers[tier].color, 1);
      g.strokeCircle(mx, my, 3);
    }
    const spin = still ? 0 : now * SAMPLE_FX.spinnerRadPerMs;
    g.lineStyle(1, color, 0.7);
    for (let i = 0; i < SAMPLE_FX.spinnerSegs; i += 2) {
      const a0 = spin + (i / SAMPLE_FX.spinnerSegs) * Math.PI * 2;
      g.beginPath();
      g.arc(site.x, site.y, SAMPLE_FX.spinnerR, a0, a0 + (Math.PI * 2) / SAMPLE_FX.spinnerSegs);
      g.strokePath();
    }
    if (still) return;
    const flicker = 0.7 + 0.3 * Math.sin(now / 40);
    g.lineStyle(2, color, SAMPLE_FX.beamAlpha * flicker);
    g.lineBetween(px, py - 4, site.x, site.y);
    if (now - this.lastChips > SAMPLE_FX.chipsEveryMs) {
      this.lastChips = now;
      this.chips.setParticleTint(SAMPLE_FX.kindTone[site.kind] ?? color);
      this.chips.emitParticleAt(site.x, site.y, SAMPLE_FX.chips);
    }
  }

  /** Quiet shimmer on sites that still hold samples, stronger for richer ones. */
  private glints(snap: EvaState, now: number): void {
    if (now - this.lastGlint < SAMPLE_FX.glintEveryMs) return;
    this.lastGlint = now;
    const cam = this.scene.cameras.main;
    let shown = 0;
    for (const s of snap.sites) {
      if (shown >= SAMPLE_FX.maxGlintSites) break;
      if (s.kind !== 'impact' && s.taken.length >= 3) continue;
      if (s.kind === 'impact' && s.taken.length >= 1) continue;
      if (!cam.worldView.contains(s.x, s.y)) continue;
      shown++;
      if (Math.random() > 0.35 + 0.2 * s.richness) continue;
      this.sparks.setParticleTint(s.kind === 'impact' ? 0xcff0ff : 0xffdf9a);
      this.sparks.emitParticleAt(
        s.x + Phaser.Math.Between(-SAMPLE_FX.glintRange, SAMPLE_FX.glintRange),
        s.y + Phaser.Math.Between(-SAMPLE_FX.glintRange, SAMPLE_FX.glintRange),
        1,
      );
    }
  }

  private collected(playerId: string | undefined, x: number, y: number, value: number): void {
    const snap = snaps.curr;
    const who = snap?.astronauts.find((a) => a.id === playerId);
    const tier = who?.carrying[who.carrying.length - 1]?.tier ?? 'surface';
    const spec = SAMPLE_FX.tiers[tier];
    const label = `${t(`eva.${tier}`)} +${value}`;
    const hex = `#${spec.color.toString(16).padStart(6, '0')}`;
    if (this.still) {
      worldLabels(this.scene).float(x, y - 14, label, hex);
      return;
    }
    this.sparks.setParticleTint(spec.color);
    this.sparks.emitParticleAt(x, y, 14);
    this.shockRing(x, y, spec.color, 26, 420);
    const gem = this.scene.add
      .sprite(x, y, 'samples', spec.frame)
      .setDepth(SAMPLE_FX.depth + 2)
      .setScale(0.4);
    this.scene.tweens.add({
      targets: gem,
      y: y - SAMPLE_FX.popPx,
      scale: 1.6,
      duration: SAMPLE_FX.popMs,
      ease: 'Back.easeOut',
      onComplete: () => this.fly(gem, playerId, label, hex, spec.color),
    });
  }

  private fly(
    gem: Phaser.GameObjects.Sprite,
    playerId: string | undefined,
    label: string,
    hex: string,
    color: number,
  ): void {
    if (this.still) {
      const dest = this.destination(playerId);
      gem.destroy();
      worldLabels(this.scene).float(dest.x, dest.y, label, hex);
      return;
    }
    const start = { x: gem.x, y: gem.y };
    const counter = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay: SAMPLE_FX.holdMs,
      duration: SAMPLE_FX.flyMs,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        const k = counter.getValue() ?? 0;
        const dest = this.destination(playerId);
        gem.setPosition(
          Phaser.Math.Linear(start.x, dest.x, k),
          Phaser.Math.Linear(start.y, dest.y, k) - Math.sin(k * Math.PI) * SAMPLE_FX.arcPx,
        );
        gem.setScale(1.6 - 1.0 * k).setRotation(k * 6);
        this.sparks.setParticleTint(color);
        this.sparks.emitParticleAt(gem.x, gem.y, 1);
      },
      onComplete: () => {
        const dest = this.destination(playerId);
        gem.destroy();
        this.sparks.emitParticleAt(dest.x, dest.y, 10);
        this.shockRing(dest.x, dest.y, color, 18, 360);
        worldLabels(this.scene).float(dest.x, dest.y - 10, label, hex);
      },
    });
  }

  private destination(playerId: string | undefined): { x: number; y: number } {
    if (playerId === this.own.id) return { x: this.own.x, y: this.own.y - 4 };
    const a = snaps.curr?.astronauts.find((b) => b.id === playerId);
    return a ? { x: a.x, y: a.y - 4 } : { x: this.own.x, y: this.own.y - 4 };
  }

  private shockRing(x: number, y: number, color: number, scale: number, ms: number): void {
    const ring = this.scene.add
      .circle(x, y, 3)
      .setStrokeStyle(2, color, 1)
      .setDepth(SAMPLE_FX.depth + 1);
    this.scene.tweens.add({
      targets: ring,
      scale: scale / 3,
      alpha: 0,
      duration: ms,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
