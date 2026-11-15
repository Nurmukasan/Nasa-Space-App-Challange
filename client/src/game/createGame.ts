import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '@rs/shared';
import { frameStats, recordFrame } from '../state/frameStats';
import { FieldScene } from './FieldScene';
import { InteriorScene } from './interior/InteriorScene';

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
    // ENVELOP fills the window; the edges that do not fit are cropped instead of letterboxed.
    scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { powerPreference: 'high-performance' },
    fps: { target: 60 },
    // The interior is launched by the field scene while our astronaut is inside the lander.
    scene: [FieldScene, InteriorScene],
  });
  let start = 0;
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    start = performance.now();
  });
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    frameStats.terrainMs = game.registry.get('terrainMs') ?? 0;
    const scene = game.scene.scenes[0];
    const particles =
      scene?.children.list.reduce(
        (total, object) =>
          total +
          (object instanceof Phaser.GameObjects.Particles.ParticleEmitter
            ? object.getAliveParticleCount()
            : 0),
        0,
      ) ?? 0;
    recordFrame(performance.now() - start, game.scene.scenes[0]?.children.length ?? 0, particles);
  });
  const debug = window as unknown as { rsGame?: Phaser.Game };
  if (new URLSearchParams(location.search).has('debug')) debug.rsGame = game;
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    frameStats.scriptMs = null;
    if (debug.rsGame === game) delete debug.rsGame;
  });
  return game;
}
