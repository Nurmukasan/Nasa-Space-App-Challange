import Phaser from 'phaser';
import { LANDER_POS, SITES, TICK_HZ, WORLD_PX, moveSpeed } from '@rs/shared';
import { send } from '../net/session';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { FieldJuice } from './FieldJuice';
import { FieldFx } from './fieldFx';
import { EventFx } from './EventFx';
import { HazardFx } from './HazardFx';
import { terrainTexture } from './terrainTexture';
import { EntityLayer } from './EntityLayer';
import { preloadAssets, ensureAssets } from './assets';
import { FIELD } from './style';
import { Lighting } from './Lighting';
import type { Light } from './Lighting';
const CONE_KEYS = Array.from({ length: FIELD.coneDirections }, (_, index) => `light-cone-${index}`);

const SNAP_BACK_PX = 24;

/** Walking-skeleton field view: coarse terrain, rectangles for crew, local movement. */
export class FieldScene extends Phaser.Scene {
  private lightSources: Light[] = [
    { x: LANDER_POS.x, y: LANDER_POS.y, key: 'light-ship', r: FIELD.landerRadius },
  ];
  private crewLights = new Map<string, Light>();
  private juice!: FieldJuice;
  private effects!: FieldFx;
  private eventFx!: EventFx;
  private hazardFx!: HazardFx;
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
    terrainTexture(this, salt);
    this.entities = new EntityLayer(this);
    this.effects = new FieldFx(this);
    this.eventFx = new EventFx(this);
    this.hazardFx = new HazardFx(this);
    this.juice = new FieldJuice(this);

    this.lighting = new Lighting(this);

    this.cameras.main.setBounds(0, 0, WORLD_PX, WORLD_PX);
    this.cameras.main.centerOn(LANDER_POS.x, LANDER_POS.y);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,SHIFT,E,SPACE') as typeof this.keys;
    for (const [i, kind] of ['ok', 'help', 'low_o2', 'returning', 'found'].entries())
      kb.on(`keydown-${i + 1}`, () =>
        send({ t: 'eva:ping', kind: kind as 'ok' | 'help' | 'low_o2' | 'returning' | 'found' }),
      );
    this.keys.E.on('down', () => send({ t: 'eva:interact' }));
    this.keys.SPACE.on('down', () => send({ t: 'eva:dig', on: true }));
    this.keys.SPACE.on('up', () => send({ t: 'eva:dig', on: false }));
  }

  override update(_time: number, deltaMs: number): void {
    const snap = snaps.curr;
    const st = store.getState();
    const myId = st.playerId;
    if (!snap || !myId) return;
    this.effects.update(snap, myId);
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

    this.eventFx.update(snap);
    this.hazardFx.update(snap, performance.now());
    this.juice.update(snap, myId, this.meX, this.meY, _time);
    if (mine) this.cameras.main.centerOn(this.meX, this.meY);

    this.entities.update(snap, myId, this.meX, this.meY, performance.now());

    this.lightSources.length = 1;
    for (const a of snap.astronauts) {
      if (a.status === 'inside' || a.status === 'lost') continue;
      const own = a.id === myId,
        drawn = own ? undefined : (this.entities.drawnAt(a.id) ?? a);
      let light = this.crewLights.get(a.id);
      if (!light) {
        light = { x: 0, y: 0, key: 'light-friend', r: FIELD.companionRadius };
        this.crewLights.set(a.id, light);
      }
      light.x = drawn ? drawn.x : this.meX;
      light.y = drawn ? drawn.y : this.meY;
      light.key = own
        ? CONE_KEYS[
            Math.round(
              ((((this.facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) *
                FIELD.coneDirections,
            ) % FIELD.coneDirections
          ]!
        : 'light-friend';
      light.r = own ? FIELD.helmetRadius : FIELD.companionRadius;
      this.lightSources.push(light);
    }
    this.lighting.render(snap, this.lightSources, this.cameras.main);
  }
}
