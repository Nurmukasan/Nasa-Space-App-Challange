// The AI assistant's screen on the bridge plus its subtitle line. Redraws only when the face changes.
import type Phaser from 'phaser';
import { prefs } from '../../state/prefs';
import { t } from '../../i18n';
import { SCREEN_H, SCREEN_W, drawScreen } from './interiorProps';
import { PROPS, TILE } from './layout';
import { assistant } from './assistant';

const SCREEN_PROP = PROPS.find((p) => p.action === 'talk')!;
const FLASH_MS = 300;

export class AiScreen {
  private tex: Phaser.Textures.CanvasTexture;
  private key = '';
  private subtitle: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    makeText: (size: string, color: string) => Phaser.GameObjects.Text,
  ) {
    this.tex =
      (scene.textures.exists('ai_screen') &&
        (scene.textures.get('ai_screen') as Phaser.Textures.CanvasTexture)) ||
      scene.textures.createCanvas('ai_screen', SCREEN_W, SCREEN_H)!;
    scene.add
      .image(
        SCREEN_PROP.col * TILE - 4,
        (SCREEN_PROP.row + SCREEN_PROP.h) * TILE - SCREEN_H,
        'ai_screen',
      )
      .setOrigin(0)
      .setDepth((SCREEN_PROP.row + SCREEN_PROP.h) * TILE);
    this.subtitle = makeText('9px', '#9af7f0')
      .setOrigin(0.5, 0)
      .setWordWrapWidth(300)
      .setPosition(scene.scale.width / 2, scene.scale.height - 2 * TILE)
      .setOrigin(0.5, 1);
  }

  update(time: number): void {
    const look = assistant.look(time);
    const flash = !prefs.getState().reduceMotion && Math.floor(time / FLASH_MS) % 2 === 0;
    const key = `${look.mood}|${look.mouth}|${look.eyesClosed}|${look.alarm}|${flash && !!look.alarm}`;
    if (key !== this.key) {
      this.key = key;
      drawScreen(this.tex.getContext(), look, flash);
      this.tex.refresh();
    }
    this.subtitle.setVisible(!!look.text);
    if (look.text) this.subtitle.setText(`${t('interior.ai.name')}: ${look.text}`);
  }
}
