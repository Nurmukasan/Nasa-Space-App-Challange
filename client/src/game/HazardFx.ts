import Phaser from 'phaser';
import { SEISMIC, VIEW_H, VIEW_W } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { prefs } from '../state/prefs';

const HAZARD_FX = {
  depth: 1290,
  tintDepth: 900,
  tintColor: 0x8a3a1c,
  tintMaxAlpha: 0.22,
  rampS: 3,
  pulseMs: 110,
  fillColor: 0xff5a3c,
  fillBase: 0.1,
  fillGain: 0.26,
  ringWidth: 2,
  ticks: 12,
  tickLen: 10,
  lingerS: 0.25,
};

/**
 * Persistent readouts for dangers the crew has been warned about: a rockfall zone that fills
 * in as impact nears, and a rust-coloured tint over the whole view while a dust storm blows.
 */
export class HazardFx {
  private zone: Phaser.GameObjects.Graphics;
  private tint: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.zone = scene.add.graphics().setDepth(HAZARD_FX.depth);
    this.tint = scene.add
      .rectangle(0, 0, VIEW_W, VIEW_H, HAZARD_FX.tintColor, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(HAZARD_FX.tintDepth)
      .setVisible(false);
  }

  update(snap: EvaState, now: number): void {
    const still = prefs.getState().reduceMotion;
    this.drawZones(snap, now, still);
    const storm = snap.weather.storm;
    let level = 0;
    if (storm && snap.t >= storm.tStart && snap.t < storm.tEnd)
      level = Math.min(
        1,
        (snap.t - storm.tStart) / HAZARD_FX.rampS,
        (storm.tEnd - snap.t) / HAZARD_FX.rampS,
      );
    this.tint.setVisible(level > 0).setAlpha(level * HAZARD_FX.tintMaxAlpha);
  }

  private drawZones(snap: EvaState, now: number, still: boolean): void {
    const g = this.zone;
    g.clear();
    for (const h of snap.hazards) {
      const left = h.tHit - snap.t;
      if (left < -HAZARD_FX.lingerS) continue;
      const progress = Phaser.Math.Clamp(1 - left / SEISMIC.rockfallDelayS, 0, 1);
      const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now / HAZARD_FX.pulseMs);
      g.fillStyle(HAZARD_FX.fillColor, HAZARD_FX.fillBase + HAZARD_FX.fillGain * progress * pulse);
      g.fillCircle(h.x, h.y, Math.max(2, h.r * progress));
      g.lineStyle(HAZARD_FX.ringWidth, HAZARD_FX.fillColor, 0.55 + 0.4 * pulse);
      g.strokeCircle(h.x, h.y, h.r);
      for (let i = 0; i < HAZARD_FX.ticks; i++) {
        const a = (i / HAZARD_FX.ticks) * Math.PI * 2 + (still ? 0 : now / 4000);
        g.lineBetween(
          h.x + Math.cos(a) * h.r,
          h.y + Math.sin(a) * h.r,
          h.x + Math.cos(a) * (h.r - HAZARD_FX.tickLen),
          h.y + Math.sin(a) * (h.r - HAZARD_FX.tickLen),
        );
      }
    }
  }
}
