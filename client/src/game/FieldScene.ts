import Phaser from 'phaser';
import {
  clampToWorld,
  DIG,
  LANDER_POS,
  SITES,
  TICK_HZ,
  VIEW_H,
  VIEW_W,
  fieldSpeed,
  generateSites,
  inCave,
  roverSpeed,
  slideMove,
  worldBounds,
} from '@rs/shared';
import { send } from '../net/session';
import { snaps } from '../state/snapshots';
import { prefs } from '../state/prefs';
import { store } from '../state/store';
import { HazardLayer } from './HazardLayer';
import { PortLayer } from './PortLayer';
import { PersonalTaskMarker } from './PersonalTaskMarker';
import { PropLayer } from './PropLayer';
import { FieldJuice } from './FieldJuice';
import { FieldFx } from './fieldFx';
import { EventFx } from './EventFx';
import { HazardFx } from './HazardFx';
import { StormFx } from './StormFx';
import { SampleFx } from './SampleFx';
import { WorldChunks } from './WorldChunks';
import { ExpeditionLayer } from './ExpeditionLayer';
import { EntityLayer } from './EntityLayer';
import { preloadAssets, ensureAssets } from './assets';
import { ensureCrewTextures } from './crewTextures';
import { FIELD } from './style';
import { worldLabels } from './WorldLabels';
import { Lighting } from './Lighting';
import type { Light } from './Lighting';
const CONE_KEYS = Array.from({ length: FIELD.coneDirections }, (_, index) => `light-cone-${index}`);

type FieldKeys = Record<'W' | 'A' | 'S' | 'D' | 'SHIFT' | 'E' | 'SPACE', Phaser.Input.Keyboard.Key>;
const SNAP_BACK_PX = 24;

/** Walking-skeleton field view: coarse terrain, rectangles for crew, local movement. */
export class FieldScene extends Phaser.Scene {
  private lightSources: Light[] = [
    { x: LANDER_POS.x, y: LANDER_POS.y, key: 'light-ship', r: FIELD.landerRadius },
  ];
  private crewLights = new Map<string, Light>();
  private hazards!: HazardLayer;
  private ports!: PortLayer;
  private taskMarker!: PersonalTaskMarker;
  private juice!: FieldJuice;
  private effects!: FieldFx;
  private eventFx!: EventFx;
  private hazardFx!: HazardFx;
  private stormFx!: StormFx;
  private sampleFx!: SampleFx;
  private entities!: EntityLayer;
  private chunks!: WorldChunks;
  private expedition!: ExpeditionLayer;
  private salt = 0;
  private keys!: FieldKeys;
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
    ensureCrewTextures(this.textures);
    const room = store.getState().room;
    const salt = SITES[room?.params?.site ?? 'jezero'].terrainSalt;
    this.salt = salt;
    // The world streams in 128 px chunks around the camera (5632 px would not fit one texture).
    this.chunks = new WorldChunks(
      this,
      salt,
      room?.params?.scenario !== 'free',
      snaps.curr?.sites ?? [],
    );
    const started = performance.now();
    this.chunks.fill(
      new Phaser.Geom.Rectangle(
        LANDER_POS.x - VIEW_W / 2,
        LANDER_POS.y - VIEW_H / 2,
        VIEW_W,
        VIEW_H,
      ),
    );
    this.registry.set('terrainMs', performance.now() - started);
    if (room?.params) new PropLayer(this, salt, generateSites(room.params));
    this.expedition = new ExpeditionLayer(this);
    this.entities = new EntityLayer(this);
    this.effects = new FieldFx(this);
    this.eventFx = new EventFx(this);
    this.hazardFx = new HazardFx(this);
    this.stormFx = new StormFx(this);
    this.sampleFx = new SampleFx(this);
    this.hazards = new HazardLayer(this);
    this.ports = new PortLayer(this);
    this.taskMarker = new PersonalTaskMarker(this);
    this.juice = new FieldJuice(this);

    this.lighting = new Lighting(this);
    const stopMotion = prefs.subscribe((next, previous) => {
      if (!next.reduceMotion || previous.reduceMotion) return;
      this.cameras.main.shakeEffect.reset();
      this.cameras.main.flashEffect.reset();
      for (const tween of this.tweens.getTweens()) tween.complete();
    });
    this.events.once('shutdown', stopMotion);
    this.events.once('destroy', stopMotion);

    // Training and Free keep the v1 valley; RED SIGNAL opens the big world (PL 7.24).
    const bounds = worldBounds(room?.params?.bigWorld ?? false);
    this.cameras.main.setBounds(
      bounds.min,
      bounds.min,
      bounds.max - bounds.min,
      bounds.max - bounds.min,
    );
    this.cameras.main.centerOn(LANDER_POS.x, LANDER_POS.y);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,SHIFT,E,SPACE') as FieldKeys;
    const pings = ['ok', 'help', 'low_o2', 'returning', 'found', 'shaking'] as const;
    for (const [i, kind] of pings.entries())
      kb.on(`keydown-${i + 1}`, () => send({ t: 'eva:ping', kind }));
    // Inside the lander the interior scene owns the E key (rooms, then the outer hatch).
    this.keys.E.on('down', () => {
      if (!this.scene.isActive('interior')) send({ t: 'eva:interact' });
    });
    this.keys.SPACE.on('down', () => send({ t: 'eva:dig', on: true }));
    this.keys.SPACE.on('up', () => send({ t: 'eva:dig', on: false }));
  }

  /** Show the lander interior while our astronaut is inside; hide it when they cycle out. */
  private syncInterior(inside: boolean): void {
    const active = this.scene.isActive('interior');
    if (inside === active) return;
    if (inside) this.scene.launch('interior');
    else this.scene.stop('interior');
    worldLabels(this).setHidden(inside);
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
    this.syncInterior(mine?.status === 'inside');
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
          // Driving uses the rover's speed; walls (tube rims) stop both, exactly as the server.
          const speed = mine.inRover
            ? roverSpeed(params, snap, this.meX, this.meY)
            : fieldSpeed(params, snap, this.meX, this.meY, running, mine.crewClass);
          const to = slideMove(
            this.meX,
            this.meY,
            clampToWorld(this.meX + dx * speed * dt, params.bigWorld),
            clampToWorld(this.meY + dy * speed * dt, params.bigWorld),
            this.salt,
            mine.inRover,
          );
          this.meX = to.x;
          this.meY = to.y;
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
    this.stormFx.update(snap, performance.now());
    this.sampleFx.update(
      snap,
      myId,
      this.meX,
      this.meY,
      performance.now(),
      store.getState().room?.params?.maxDepth ?? DIG.coreDepth,
    );
    this.hazards.update(snap, _time);
    this.ports.update(snap, myId, st.room?.players.find((p) => p.id === myId)?.role === 'solo');
    this.taskMarker.update(snap, myId);
    this.juice.update(snap, myId, this.meX, this.meY, _time);
    if (mine) this.cameras.main.centerOn(this.meX, this.meY);
    this.chunks.update(this.cameras.main.worldView);

    this.expedition.update(snap, myId, this.meX, this.meY);
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
    // Under the rock of a lava tube it is always night: only the helmet lamp helps.
    const sheltered =
      !!params?.bigWorld && mine?.status === 'active' && inCave(this.meX, this.meY, this.salt);
    this.lighting.render(snap, this.lightSources, this.cameras.main, sheltered);
  }
}
