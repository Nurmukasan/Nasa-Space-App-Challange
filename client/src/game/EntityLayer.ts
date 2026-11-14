import Phaser from 'phaser';
import { prefs } from '../state/prefs';
import { LANDER_POS, LAUNCH_COUNTDOWN_S, O2, PLAYER_COLORS } from '@rs/shared';
import type { Astronaut, EvaState } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { evaText } from '../i18n/en/eva';
import { FIELD } from './style';
import { skinKey } from './skins';
import { worldLabels } from './WorldLabels';
import type { WorldLabels } from './WorldLabels';
import { RemoteInterpolator } from './interpolation';
import type { Point } from './interpolation';

interface CrewVisual {
  body: Phaser.GameObjects.Sprite;
  stripe: Phaser.GameObjects.Sprite;
}

/** Waypoint flag sprite: 6 animation frames, the pole foot sits on the target point. */
const BEACON_FRAMES = 6;
const BEACON_ORIGIN_Y = 21 / 24;
const BASE_HALF_H = 48;

export class EntityLayer {
  private lander: Phaser.GameObjects.Image;
  private landingFlame: Phaser.GameObjects.Sprite;
  private baseIndicators: Array<Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle> = [];
  private observed: EvaState | null = null;
  private liveIds = new Set<string>();
  private crew = new Map<string, CrewVisual>();
  private sites = new Map<string, Phaser.GameObjects.Sprite>();
  private stations: Phaser.GameObjects.Image[] = [];
  private beacon: Phaser.GameObjects.Sprite;
  private labels: WorldLabels;
  private remote = new RemoteInterpolator(
    FIELD.interpolationMs / 1000,
    FIELD.interpolationHistory,
    FIELD.clockSmoothing,
    FIELD.clockResyncS,
  );
  private at: Point = { x: 0, y: 0 };

  constructor(private scene: Phaser.Scene) {
    this.lander = scene.add.image(LANDER_POS.x, LANDER_POS.y, 'lander').setDepth(LANDER_POS.y);
    this.landingFlame = scene.add
      .sprite(LANDER_POS.x, LANDER_POS.y, 'lander_flame')
      .setOrigin(0.5, 0)
      .setDepth(LANDER_POS.y - 1)
      .setVisible(false);
    this.baseLights(scene);
    this.beacon = scene.add
      .sprite(0, 0, 'beacon')
      .setOrigin(0.5, BEACON_ORIGIN_Y)
      .setDepth(1200)
      .setVisible(false);
    this.labels = worldLabels(scene);
  }

  /** The base is alive: a blinking mast light and a pulsing airlock glow. */
  private baseLights(scene: Phaser.Scene): void {
    if (prefs.getState().reduceMotion) return;
    const mast = scene.add
      .circle(768, 768 - BASE_HALF_H + 1, 2.5, 0xff4a40, 1)
      .setDepth(769)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: mast, alpha: 0.1, yoyo: true, repeat: -1, duration: 650 });
    const door = scene.add
      .rectangle(768, 768 - BASE_HALF_H + 65, 12, 22, 0x50e6f0, 0.28)
      .setDepth(769)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: door, alpha: 0.08, yoyo: true, repeat: -1, duration: 1300 });
    this.baseIndicators.push(mast, door);
  }

  update(snap: EvaState, myId: string, x: number, y: number, now: number): void {
    const reduce = prefs.getState().reduceMotion;
    const descent = reduce ? 0 : Math.max(0, Math.min(1, -snap.t / LAUNCH_COUNTDOWN_S));
    const shipY = LANDER_POS.y - descent * FIELD.landingHeight;
    this.lander.setY(shipY);
    this.landingFlame
      .setVisible(snap.t < 0 && !reduce)
      .setPosition(LANDER_POS.x, shipY + 36)
      .setFrame(Math.floor(now / 100) % 4);
    for (const indicator of this.baseIndicators) indicator.setVisible(snap.t >= 0);
    const roster = store.getState().room?.players ?? [];
    if (this.observed !== snap) {
      this.observed = snap;
      this.liveIds.clear();
      for (const a of snap.astronauts) this.liveIds.add(a.id);
      for (const [id, v] of this.crew)
        if (!this.liveIds.has(id)) {
          v.body.destroy();
          v.stripe.destroy();
          this.labels.forget(`name:${id}`);
          this.crew.delete(id);
        }
      this.remote.observe(snap, snaps.currAt);
    }
    for (const a of snap.astronauts) {
      let v = this.crew.get(a.id);
      if (!v) {
        const color = PLAYER_COLORS[roster.find((p) => p.id === a.id)?.colorIdx ?? 0] ?? FIELD.cyan;
        v = {
          body: this.scene.add.sprite(
            a.x,
            a.y,
            a.id === myId ? skinKey(prefs.getState().skin) : 'astronaut',
          ),
          stripe: this.scene.add.sprite(a.x, a.y, 'astronaut_stripe').setTint(color),
        };
        this.crew.set(a.id, v);
      }
      if (a.id === myId) {
        this.at.x = x;
        this.at.y = y;
      } else if (!this.remote.position(a.id, now, this.at)) {
        this.at.x = a.x;
        this.at.y = a.y;
      }
      const px = this.at.x,
        py = this.at.y;
      const frame =
        a.status === 'down' || a.status === 'lost'
          ? 8
          : a.digging
            ? 6 + (Math.floor(now / 180) % 2)
            : a.moving
              ? 2 + (Math.floor(now / 120) % 4)
              : Math.floor(now / 500) % 2;
      v.body
        .setPosition(px, py)
        .setFrame(frame)
        .setDepth(py)
        .setVisible(snap.t >= 0 && a.status !== 'inside')
        .setAlpha(a.status === 'lost' ? 0.4 : 1);
      v.stripe
        .setPosition(px, py)
        .setFrame(frame)
        .setDepth(py + 0.1)
        .setVisible(snap.t >= 0 && a.status !== 'inside');
      if (snap.t >= 0 && a.status !== 'inside')
        this.labels.set(
          `name:${a.id}`,
          roster.find((p) => p.id === a.id)?.name ?? a.id,
          px,
          py - 14,
          'name',
        );
    }
    const siteIds = new Set(snap.sites.map((s) => s.id));
    for (const [id, v] of this.sites)
      if (!siteIds.has(id)) {
        v.destroy();
        this.sites.delete(id);
      }
    for (const s of snap.sites) {
      let v = this.sites.get(s.id);
      if (!v) {
        v = this.scene.add.sprite(s.x, s.y, `site_${s.kind}`).setDepth(s.y - 1);
        this.sites.set(s.id, v);
      }
      v.setFrame(s.depth > 0 ? 1 : 0);
    }
    while (this.stations.length < snap.stations.length)
      this.stations.push(this.scene.add.image(0, 0, 'station'));
    snap.stations.forEach((s, i) => this.stations[i]!.setPosition(s.x, s.y).setDepth(s.y));
    const mine = snap.astronauts.find((a) => a.id === myId);
    this.updateWaypoint(mine, x, y, now);
    const rescue = snap.astronauts.some(
      (a) => a.id !== myId && a.status === 'down' && Math.hypot(a.x - x, a.y - y) <= O2.shareRange,
    );
    const airlock = Math.hypot(x - snap.lander.x, y - snap.lander.y) <= O2.airlockRadius;
    const hintText =
      mine?.status === 'inside'
        ? evaText('eva.exit')
        : rescue
          ? evaText('eva.rescue')
          : airlock
            ? evaText('eva.airlock')
            : '';
    if (hintText) this.labels.set('hint', hintText, x, y + 22, 'hint');
    this.labels.flush();
  }

  /** Where an astronaut is drawn this frame, so lights follow the interpolated sprite. */
  drawnAt(id: string): Point | undefined {
    return this.crew.get(id)?.body;
  }

  private updateWaypoint(mine: Astronaut | undefined, x: number, y: number, now: number): void {
    const point = mine?.linked ? mine.waypoint : null;
    this.beacon.setVisible(!!point);
    if (!point) return;
    this.beacon.setPosition(point.x, point.y).setFrame(Math.floor(now / 140) % BEACON_FRAMES);
    const cam = this.scene.cameras.main,
      sx = point.x - cam.scrollX,
      sy = point.y - cam.scrollY;
    const v = this.labels.visible();
    if (sx >= v.x0 + 12 && sx <= v.x1 - 12 && sy >= v.y0 + 12 && sy <= v.y1 - 12) return;
    const mx = (v.x0 + v.x1) / 2,
      my = (v.y0 + v.y1) / 2;
    const dx = sx - mx,
      dy = sy - my;
    const k = Math.min(
      ((v.x1 - v.x0) / 2 - 40) / Math.max(1, Math.abs(dx)),
      ((v.y1 - v.y0) / 2 - 35) / Math.max(1, Math.abs(dy)),
    );
    const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '→' : '←') : dy > 0 ? '↓' : '↑';
    this.labels.set(
      'arrow',
      `${direction} ${evaText('eva.waypoint', { n: Math.round(Math.hypot(point.x - x, point.y - y) * 0.25) })}`,
      mx + dx * k,
      my + dy * k,
      'arrow',
      true,
    );
  }
}
