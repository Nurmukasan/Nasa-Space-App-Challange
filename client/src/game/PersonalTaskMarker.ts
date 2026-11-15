import type Phaser from 'phaser';
import type { EvaState } from '@rs/shared';
import { t } from '../i18n';
import { taskDestination } from '../ui/taskView';
import { FIELD } from './style';

/** Static assignment marker; only public destinations reach this renderer. */
export class PersonalTaskMarker {
  private ring: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private key = '';

  constructor(scene: Phaser.Scene) {
    this.ring = scene.add.graphics().setDepth(FIELD.taskDepth);
    this.label = scene.add
      .text(0, 0, t('tasks.marker'), {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#ffce72',
        backgroundColor: '#170a0b',
      })
      .setOrigin(0.5, 1)
      .setDepth(FIELD.taskDepth);
    this.label.setVisible(false);
  }

  update(snap: EvaState, playerId: string): void {
    const task = snap.taskBoard?.tasks.find((t) => t.ownerId === playerId && t.state === 'active');
    const a = snap.astronauts.find((p) => p.id === playerId);
    const destination = task && taskDestination(task, snap.lander, a?.carrying);
    if (!task || !destination || a?.status !== 'active') {
      this.ring.setVisible(false);
      this.label.setVisible(false);
      this.key = '';
      return;
    }
    const radius =
      task.kind === 'deliver' ? FIELD.taskRadius : (task.target?.r ?? FIELD.taskRadius);
    const key = `${task.id}:${task.kind}:${destination.x}:${destination.y}:${radius}`;
    if (key === this.key) return;
    this.key = key;
    this.ring
      .clear()
      .lineStyle(1, FIELD.gold, 0.85)
      .strokeCircle(destination.x, destination.y, radius);
    this.ring.setVisible(true);
    this.label
      .setPosition(destination.x, destination.y - radius - FIELD.taskLabelGap)
      .setVisible(true);
  }
}
