import type Phaser from 'phaser';
import { FAULTS, LANDER_POS } from '@rs/shared';
import type { EvaState, ServicePort } from '@rs/shared';
import { prefs } from '../state/prefs';
import { FIELD } from './style';
const PORTS: Record<ServicePort, readonly [number, number]> = {
  n: [0, -1],
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
};

/** Multiplayer only highlights the port already identified by Mission Control's waypoint. */
export class PortLayer {
  private ports = new Map<ServicePort, Phaser.GameObjects.Sprite>();
  private progress: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    for (const port of Object.keys(PORTS) as ServicePort[]) {
      const [dx, dy] = PORTS[port];
      this.ports.set(
        port,
        scene.add
          .sprite(LANDER_POS.x + dx * FAULTS.portDist, LANDER_POS.y + dy * FAULTS.portDist, 'port')
          .setDepth(LANDER_POS.y + dy * FAULTS.portDist + 1)
          .setVisible(false),
      );
    }
    this.progress = scene.add.graphics().setDepth(870);
  }
  update(snap: EvaState, playerId: string, solo: boolean): void {
    const a = snap.astronauts.find((a) => a.id === playerId);
    const reduce = prefs.getState().reduceMotion;
    this.progress.clear();
    for (const [port, sprite] of this.ports) {
      const [dx, dy] = PORTS[port];
      const x = snap.lander.x + dx * FAULTS.portDist,
        y = snap.lander.y + dy * FAULTS.portDist;
      const fault = snap.lander.faults.find((f) => f.port === port);
      const marked =
        a?.linked &&
        a.waypoint &&
        Math.hypot(a.waypoint.x - x, a.waypoint.y - y) <= FAULTS.portRadius;
      const known = !!fault && (solo || a?.repairing === fault.id || marked);
      sprite
        .setVisible(snap.scenario !== 'free')
        .setPosition(x, y)
        .setFrame(known ? 1 : 0)
        .setTint(known ? FIELD.gold : FIELD.cyan)
        .setAlpha(known && !reduce ? 0.7 + Math.sin(snap.t * 7) * 0.3 : 1);
      if (known && fault.progress > 0) {
        this.progress.lineStyle(2, FIELD.gold, 0.9).beginPath();
        this.progress.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fault.progress);
        this.progress.strokePath();
      }
    }
  }
}
