import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '@rs/shared';
import { FieldScene } from './FieldScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#140e2c',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { powerPreference: 'high-performance' },
    fps: { target: 60 },
    scene: [FieldScene],
  });
}
