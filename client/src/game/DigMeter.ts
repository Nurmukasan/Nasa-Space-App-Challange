// Digging mini-game bar above our astronaut (docs/product-logic.md 7.5.1).
// The marker is a pure function of mission time, so it is drawn from a smooth
// estimate of the server clock and SPACE sends exactly the position shown here.
import type Phaser from 'phaser';
import { DIG, DIG_GAME, digComboMul, digGameOn, digMarker } from '@rs/shared';
import type { Astronaut, DigGrade, EvaState, MissionParams } from '@rs/shared';
import { audio } from '../audio';
import type { SfxName } from '../audio';
import { evaText as t } from '../i18n/en/eva';
import { snaps } from '../state/snapshots';
import { FIELD } from './style';
import { worldLabels } from './WorldLabels';

const BAR_W = 44;
const BAR_H = 4;
/** Bar top above the astronaut, px: clear of the name tag. */
const BAR_DY = 38;
/** Never run the local clock further ahead of the last snapshot than this, s. */
const MAX_LEAD_S = 0.25;

const GRADE_COLOR: Record<DigGrade, string> = {
  perfect: '#ffce72',
  good: '#a4ec9c',
  miss: '#f0463c',
};
const GRADE_SOUND: Record<DigGrade, SfxName> = {
  perfect: 'classify_ok',
  good: 'ui_click',
  miss: 'ui_error',
};

/** Mission time now, extrapolated from the latest snapshot. */
export function clientMissionTime(): number {
  const s = snaps.curr;
  if (!s) return 0;
  return s.t + Math.min(MAX_LEAD_S, Math.max(0, (performance.now() - snaps.currAt) / 1000));
}

export class DigMeter {
  private g: Phaser.GameObjects.Graphics;
  private seenStroke = -1;

  constructor(private scene: Phaser.Scene) {
    // Interface, not world: above the night lighting (Lighting.ts tops out at 10910).
    this.g = scene.add.graphics().setDepth(11210);
  }

  /** Phase to send with a stroke: exactly what the bar shows now. */
  phase(mine: Astronaut | undefined): number {
    return mine?.dig ? digMarker(mine.dig, clientMissionTime()) : 0;
  }

  update(
    snap: EvaState,
    mine: Astronaut | undefined,
    params: MissionParams | undefined,
    x: number,
    y: number,
  ): void {
    this.g.clear();
    if (!mine || !params || !digGameOn(params) || mine.status !== 'active') return;
    const labels = worldLabels(this.scene);
    const dig = mine.dig;
    if (!dig) {
      const site = snap.sites.find(
        (s) =>
          (s.expiresAt === null || s.expiresAt > snap.t) &&
          Math.hypot(s.x - x, s.y - y) <= DIG.reach,
      );
      if (site && !mine.inRover && mine.carrying.length < params.carryCap)
        labels.set('dig', t('eva.dig_start'), x, y + 22, 'hint');
      this.seenStroke = -1;
      return;
    }
    // Flash each new stroke once; a session seen for the first time only sets the counter.
    if (dig.last && this.seenStroke >= 0 && dig.n !== this.seenStroke) this.flash(dig.last, x, y);
    this.seenStroke = dig.n;

    const left = Math.round(x - BAR_W / 2),
      top = Math.round(y - BAR_DY);
    const at = (p: number) => left + p * BAR_W;
    const locked = clientMissionTime() < dig.lockUntil;
    this.g.fillStyle(0x000000, 0.65).fillRect(left - 1, top - 1, BAR_W + 2, BAR_H + 2);
    this.g
      .fillStyle(FIELD.cyan, locked ? 0.25 : 0.55)
      .fillRect(at(dig.zone - DIG_GAME.goodHalf), top, DIG_GAME.goodHalf * 2 * BAR_W, BAR_H);
    this.g
      .fillStyle(FIELD.gold, locked ? 0.35 : 0.95)
      .fillRect(at(dig.zone - DIG_GAME.perfectHalf), top, DIG_GAME.perfectHalf * 2 * BAR_W, BAR_H);
    const mx = Math.round(at(this.phase(mine)));
    this.g.fillStyle(FIELD.white, 1).fillRect(mx, top - 2, 1, BAR_H + 4);
    this.g.fillTriangle(mx - 2, top - 4, mx + 3, top - 4, mx + 0.5, top - 1);
    const aim = t('eva.dig_aim');
    labels.set(
      'dig',
      dig.combo > 0
        ? `${t('eva.dig_combo', { n: digComboMul(dig.combo).toFixed(1) })} · ${aim}`
        : aim,
      x,
      y + 22,
      'hint',
    );
  }

  private flash(grade: DigGrade, x: number, y: number): void {
    audio.sfx(GRADE_SOUND[grade], { volume: grade === 'miss' ? 0.6 : 0.8 });
    worldLabels(this.scene).float(x, y - BAR_DY - 10, t(`eva.dig_${grade}`), GRADE_COLOR[grade]);
  }
}
