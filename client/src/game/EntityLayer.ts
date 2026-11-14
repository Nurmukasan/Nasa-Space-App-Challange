import type Phaser from 'phaser';
import { O2, PLAYER_COLORS, VIEW_H, VIEW_W } from '@rs/shared';
import type { Astronaut, EvaState } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { evaText } from '../i18n/en/eva';
import { FIELD } from './style';
import { worldLabels } from './WorldLabels';
import type { WorldLabels } from './WorldLabels';
import { RemoteInterpolator } from './interpolation';
import type { Point } from './interpolation';

interface CrewVisual {
  body: Phaser.GameObjects.Sprite;
  stripe: Phaser.GameObjects.Sprite;
}

export class EntityLayer {
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
    scene.add.image(768, 768, 'lander').setDepth(768);
    this.beacon = scene.add.sprite(0, 0, 'beacon').setDepth(1200).setVisible(false);
    this.labels = worldLabels(scene);
  }

  update(snap: EvaState, myId: string, x: number, y: number, now: number): void {
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
          body: this.scene.add.sprite(a.x, a.y, 'astronaut'),
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
        .setVisible(a.status !== 'inside')
        .setAlpha(a.status === 'lost' ? 0.4 : 1);
      v.stripe
        .setPosition(px, py)
        .setFrame(frame)
        .setDepth(py + 0.1)
        .setVisible(a.status !== 'inside');
      if (a.status !== 'inside')
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
    this.beacon.setPosition(point.x, point.y).setFrame(Math.floor(now / 180) % 4);
    const cam = this.scene.cameras.main,
      sx = point.x - cam.scrollX,
      sy = point.y - cam.scrollY;
    if (sx >= 12 && sx <= VIEW_W - 12 && sy >= 12 && sy <= VIEW_H - 12) return;
    const dx = sx - VIEW_W / 2,
      dy = sy - VIEW_H / 2;
    const k = Math.min(
      (VIEW_W / 2 - 40) / Math.max(1, Math.abs(dx)),
      (VIEW_H / 2 - 35) / Math.max(1, Math.abs(dy)),
    );
    const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '→' : '←') : dy > 0 ? '↓' : '↑';
    this.labels.set(
      'arrow',
      `${direction} ${evaText('eva.waypoint', { n: Math.round(Math.hypot(point.x - x, point.y - y) * 0.25) })}`,
      VIEW_W / 2 + dx * k,
      VIEW_H / 2 + dy * k,
      'arrow',
      true,
    );
  }
}
