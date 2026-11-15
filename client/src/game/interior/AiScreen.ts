// ARIA's animated face over the lab terminal, plus the subtitle line. Redraws only on change.
import type Phaser from 'phaser';
import { prefs } from '../../state/prefs';
import { t } from '../../i18n';
import { FACE_H, FACE_W, FACE_X, FACE_Y, drawFace } from './interiorProps';
import { assistant } from './assistant';

const FLASH_MS = 300;
/** Subtitle sits just above the bottom of the screen. */
const SUBTITLE_BOTTOM = 30;

export class AiScreen {
  private tex: Phaser.Textures.CanvasTexture;
  private key = '';
  private subtitle: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    makeText: (size: string, color: string) => Phaser.GameObjects.Text,
  ) {
    this.tex =
      (scene.textures.exists('ai_face') &&
        (scene.textures.get('ai_face') as Phaser.Textures.CanvasTexture)) ||
      scene.textures.createCanvas('ai_face', FACE_W, FACE_H)!;
    scene.add
      .image(FACE_X, FACE_Y, 'ai_face')
      .setOrigin(0)
      .setDepth(FACE_Y + FACE_H);
    this.subtitle = makeText('9px', '#9af7f0')
      .setOrigin(0.5, 1)
      .setWordWrapWidth(300)
      .setScrollFactor(0)
      .setPosition(scene.scale.width / 2, scene.scale.height - SUBTITLE_BOTTOM);
  }

  update(time: number): void {
    const look = assistant.look(time);
    const flash = !prefs.getState().reduceMotion && Math.floor(time / FLASH_MS) % 2 === 0;
    const key = `${look.mood}|${look.mouth}|${look.eyesClosed}|${look.alarm}|${flash && !!look.alarm}`;
    if (key !== this.key) {
      this.key = key;
      drawFace(this.tex.getContext(), look, flash);
      this.tex.refresh();
    }
    this.subtitle.setVisible(!!look.text);
    if (look.text) this.subtitle.setText(`${t('interior.ai.name')}: ${look.text}`);
  }
}
