import type Phaser from 'phaser';
import { O2, PLAYER_COLORS, VIEW_H, VIEW_W } from '@rs/shared';
import type { Astronaut, EvaState } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { evaText } from '../i18n/en/eva';
import { FIELD } from './style';

interface CrewVisual {
  body: Phaser.GameObjects.Sprite;
  stripe: Phaser.GameObjects.Sprite;
  name: Phaser.GameObjects.Text;
}

export class EntityLayer {
  private crew = new Map<string, CrewVisual>();
  private sites = new Map<string, Phaser.GameObjects.Sprite>();
  private stations: Phaser.GameObjects.Image[] = [];
  private beacon: Phaser.GameObjects.Sprite;
  private arrow: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    scene.add.image(768, 768, 'lander').setDepth(768);
    this.beacon = scene.add.sprite(0, 0, 'beacon').setDepth(1200).setVisible(false);
    this.arrow = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#50e6f0',
        backgroundColor: '#101a28',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1300);
    this.hint = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#e2ecff',
        backgroundColor: '#101a28',
      })
      .setOrigin(0.5)
      .setDepth(1250);
  }

  update(snap: EvaState, myId: string, x: number, y: number, now: number): void {
    const roster = store.getState().room?.players ?? [];
    const liveIds = new Set(snap.astronauts.map((a) => a.id));
    for (const [id, v] of this.crew)
      if (!liveIds.has(id)) {
        v.body.destroy();
        v.stripe.destroy();
        v.name.destroy();
        this.crew.delete(id);
      }
    const alpha = Math.max(
      0,
      Math.min(
        1,
        (now - FIELD.interpolationMs - snaps.prevAt) / Math.max(1, snaps.currAt - snaps.prevAt),
      ),
    );
    for (const a of snap.astronauts) {
      let v = this.crew.get(a.id);
      if (!v) {
        const color = PLAYER_COLORS[roster.find((p) => p.id === a.id)?.colorIdx ?? 0] ?? FIELD.cyan;
        v = {
          body: this.scene.add.sprite(a.x, a.y, 'astronaut'),
          stripe: this.scene.add.sprite(a.x, a.y, 'astronaut_stripe').setTint(color),
          name: this.scene.add
            .text(a.x, a.y - 13, roster.find((p) => p.id === a.id)?.name ?? a.id, {
              fontFamily: 'monospace',
              fontSize: '7px',
              color: '#e2ecff',
              stroke: '#171526',
              strokeThickness: 2,
            })
            .setOrigin(0.5),
        };
        this.crew.set(a.id, v);
      }
      const prev = snaps.prev?.astronauts.find((p) => p.id === a.id);
      const px = a.id === myId ? x : prev ? prev.x + (a.x - prev.x) * alpha : a.x;
      const py = a.id === myId ? y : prev ? prev.y + (a.y - prev.y) * alpha : a.y;
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
      v.name
        .setPosition(px, py - 13)
        .setDepth(py + 0.2)
        .setVisible(a.status !== 'inside');
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
    this.hint
      .setPosition(x, y + 20)
      .setText(
        mine?.status === 'inside'
          ? evaText('eva.exit')
          : rescue
            ? evaText('eva.rescue')
            : airlock
              ? evaText('eva.airlock')
              : '',
      );
  }

  private updateWaypoint(mine: Astronaut | undefined, x: number, y: number, now: number): void {
    const point = mine?.linked ? mine.waypoint : null;
    this.beacon.setVisible(!!point);
    this.arrow.setVisible(false);
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
    this.arrow
      .setPosition(VIEW_W / 2 + dx * k, VIEW_H / 2 + dy * k)
      .setText(
        `${direction} ${evaText('eva.waypoint', { n: Math.round(Math.hypot(point.x - x, point.y - y) * 0.25) })}`,
      )
      .setVisible(true);
  }
}
