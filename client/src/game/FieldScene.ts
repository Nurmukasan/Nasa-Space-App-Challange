import Phaser from 'phaser';
import {
  LANDER_POS,
  SITES,
  TICK_HZ,
  TILE,
  WORLD_PX,
  WORLD_TILES,
  levelAt,
  moveSpeed,
} from '@rs/shared';
import { send } from '../net/session';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { EntityLayer } from './EntityLayer';
import { preloadAssets, ensureAssets } from './assets';
import { Lighting, makeLightTexture } from './Lighting';

const LEVEL_COLORS = [0x6c2a2e, 0x8a362a, 0xa84a2e, 0xc6643a, 0xe28650];
const SNAP_BACK_PX = 24;

/** Walking-skeleton field view: coarse terrain, rectangles for crew, local movement. */
export class FieldScene extends Phaser.Scene {
  private entities!: EntityLayer;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'SHIFT' | 'E' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private meX = 0;
  private meY = 0;
  private facing = 0;
  private hasPos = false;
  private sendAcc = 0;
  private wasMoving = false;
  private lighting!: Lighting;

  constructor() {
    super('field');
  }

  preload(): void {
    preloadAssets(this);
  }

  create(): void {
    ensureAssets(this);
    const room = store.getState().room;
    const salt = SITES[room?.params?.site ?? 'jezero'].terrainSalt;
    const g = this.add.graphics();
    for (let ty = 0; ty < WORLD_TILES; ty++) {
      for (let tx = 0; tx < WORLD_TILES; tx++) {
        const level = levelAt(tx * TILE + TILE / 2, ty * TILE + TILE / 2, salt);
        g.fillStyle(LEVEL_COLORS[level] ?? LEVEL_COLORS[0]!, 1);
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    g.generateTexture('terrain', WORLD_PX, WORLD_PX);
    g.destroy();
    this.add.image(0, 0, 'terrain').setOrigin(0, 0);
    this.entities = new EntityLayer(this);

    makeLightTexture(this, 'light56', 56);
    makeLightTexture(this, 'light28', 28);
    this.lighting = new Lighting(this);

    this.cameras.main.setBounds(0, 0, WORLD_PX, WORLD_PX);
    this.cameras.main.centerOn(LANDER_POS.x, LANDER_POS.y);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,SHIFT,E,SPACE') as typeof this.keys;
    this.keys.E.on('down', () => send({ t: 'eva:interact' }));
    this.keys.SPACE.on('down', () => send({ t: 'eva:dig', on: true }));
    this.keys.SPACE.on('up', () => send({ t: 'eva:dig', on: false }));
  }

  override update(_time: number, deltaMs: number): void {
    const snap = snaps.curr;
    const st = store.getState();
    const myId = st.playerId;
    if (!snap || !myId) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    const params = st.room?.params;

    const mine = snap.astronauts.find((a) => a.id === myId);
    if (mine) {
      if (!this.hasPos || Math.hypot(mine.x - this.meX, mine.y - this.meY) > SNAP_BACK_PX) {
        this.meX = mine.x;
        this.meY = mine.y;
        this.hasPos = true;
      }
      if (mine.status === 'active' && snap.t >= 0 && params) {
        let dx = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
        let dy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
        const moving = dx !== 0 || dy !== 0;
        const running = moving && this.keys.SHIFT.isDown;
        if (moving) {
          const len = Math.hypot(dx, dy);
          dx /= len;
          dy /= len;
          const speed = moveSpeed(params, snap.weather, running);
          this.meX = Phaser.Math.Clamp(this.meX + dx * speed * dt, 8, WORLD_PX - 8);
          this.meY = Phaser.Math.Clamp(this.meY + dy * speed * dt, 8, WORLD_PX - 8);
          this.facing = Math.atan2(dy, dx);
        }
        this.sendAcc += dt;
        if (this.sendAcc >= 1 / TICK_HZ && (moving || this.wasMoving)) {
          this.sendAcc = 0;
          send({ t: 'eva:move', x: this.meX, y: this.meY, facing: this.facing, moving, running });
          this.wasMoving = moving;
        }
      }
    }

    if (mine) this.cameras.main.centerOn(this.meX, this.meY);

    this.entities.update(snap, myId, this.meX, this.meY, performance.now());

    const lights = [{ x: LANDER_POS.x, y: LANDER_POS.y, key: 'light56', r: 56 }];
    for (const a of snap.astronauts) {
      if (a.status === 'inside' || a.status === 'lost') continue;
      const own = a.id === myId;
      lights.push({
        x: own ? this.meX : a.x,
        y: own ? this.meY : a.y,
        key: own ? 'light56' : 'light28',
        r: own ? 56 : 28,
      });
    }
    this.lighting.render(snap.weather.light, lights, this.cameras.main);
  }
}
