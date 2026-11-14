import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '@rs/shared';
import { frameStats, recordFrame } from '../state/frameStats';
import { FieldScene } from './FieldScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
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
  let start = 0;
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    start = performance.now();
  });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    frameStats.terrainMs = game.registry.get('terrainMs') ?? 0;
    recordFrame(
      performance.now() - start,
      game.scene.scenes[0]?.children.length ?? 0,
      (game.registry.get('juiceParticles') ?? 0) + (game.registry.get('hazardParticles') ?? 0),
    );
  });
  const debug = window as unknown as { rsGame?: Phaser.Game };
  if (new URLSearchParams(location.search).has('debug')) debug.rsGame = game;
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    frameStats.scriptMs = null;
    if (debug.rsGame === game) delete debug.rsGame;
  });
  return game;
}
