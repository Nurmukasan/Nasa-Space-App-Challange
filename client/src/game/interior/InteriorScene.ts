// Inside the lander. Runs on top of the field scene while our astronaut's status is 'inside'.
// Everything here is local to this player: walking, doors and room actions are cosmetic;
// the only message sent to the engine is eva:interact at the outer hatch (go back outside).
import Phaser from 'phaser';
import { send } from '../../net/session';
import { snaps } from '../../state/snapshots';
import { prefs } from '../../state/prefs';
import { store } from '../../state/store';
import { t } from '../../i18n';
import { crewKey } from '../crewTextures';
import { CREW_FRAME } from '../crewArt';
import { paintInterior } from './interiorArt';
import { DOOR_FRAMES, DOOR_H, DOOR_W, doorSheet } from './interiorProps';
import { DOORS, DOOR_RANGE, PROPS, ROWS, SPAWN, TILE, nearestAction, step } from './layout';
import type { Prop } from './layout';
import { alarmFor, assistant } from './assistant';
import { AiScreen } from './AiScreen';
import type { AlarmKind } from './assistant';

/** Walking speed inside, px/s (cosmetic: the engine does not track position indoors). */
const SPEED = 60;
const DOOR_STEP_MS = 45;
const ANIM_WALK_MS = 120;
const ANIM_WORK_MS = 260;
/** Keeps the E prompt fully on screen next to the walls, px. */
const PROMPT_MARGIN = 44;
/** Near the top rows (wall screens, ARIA) the E prompt moves under the astronaut. */
const PROMPT_TOP = 5 * TILE;
const HATCH = DOORS.find((d) => d.outer)!;

type Mode = 'free' | 'sleep' | 'work' | 'exiting';
type Keys = Record<'W' | 'A' | 'S' | 'D' | 'E', Phaser.Input.Keyboard.Key>;

export class InteriorScene extends Phaser.Scene {
  private keys!: Keys;
  private me!: Phaser.GameObjects.Sprite;
  private x = SPAWN.x;
  private y = SPAWN.y;
  private mode: Mode = 'free';
  private target: Prop | null = null;
  private doors: Array<{ sprite: Phaser.GameObjects.Sprite; frame: number; acc: number }> = [];
  private screen!: AiScreen;
  private prompt!: Phaser.GameObjects.Text;
  private header!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private zzz!: Phaser.GameObjects.Text;
  private alarmTint!: Phaser.GameObjects.Rectangle;
  private coreGlow!: Phaser.GameObjects.Rectangle;
  private alarm: AlarmKind | null = null;
  private exitSent = false;

  constructor() {
    super('interior');
  }

  create(): void {
    if (!this.textures.exists('interior_bg'))
      this.textures.addCanvas('interior_bg', paintInterior());
    for (const outer of [false, true]) {
      const key = outer ? 'door_outer' : 'door_inner';
      if (this.textures.exists(key)) continue;
      const tex = this.textures.addCanvas(key, doorSheet(outer))!;
      for (let f = 0; f < DOOR_FRAMES; f++) tex.add(f, 0, f * DOOR_W, 0, DOOR_W, DOOR_H);
    }
    this.add.image(0, 0, 'interior_bg').setOrigin(0).setDepth(0);
    this.doors = DOORS.map((d) => ({
      sprite: this.add
        .sprite(d.x, d.y, d.outer ? 'door_outer' : 'door_inner', 0)
        .setDepth(d.y + TILE),
      frame: 0,
      acc: 0,
    }));
    const core = PROPS.find((p) => p.kind === 'core')!;
    this.coreGlow = this.add
      .rectangle((core.col + 1) * TILE, (core.row + 0.5) * TILE - 3, 22, 30, 0x40c8ff, 0.85)
      .setDepth(core.row * TILE + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (!prefs.getState().reduceMotion)
      this.tweens.add({
        targets: this.coreGlow,
        alpha: 0.35,
        yoyo: true,
        repeat: -1,
        duration: 900,
      });

    const crewClass =
      snaps.curr?.astronauts.find((a) => a.id === store.getState().playerId)?.crewClass ??
      'engineer';
    this.x = SPAWN.x;
    this.y = SPAWN.y;
    this.mode = 'free';
    this.exitSent = false;
    this.me = this.add.sprite(this.x, this.y, crewKey(crewClass), 0).setOrigin(0.5, 0.9);

    const text = (size: string, color: string) =>
      this.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: size,
          color,
          backgroundColor: '#101a28d0',
        })
        .setPadding(3, 2, 3, 2)
        .setDepth(2000);
    this.prompt = text('8px', '#e2ecff').setOrigin(0.5, 1);
    this.screen = new AiScreen(this, text);
    this.zzz = this.add.text(0, 0, 'Z z', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#e2ecff',
    });
    this.zzz.setDepth(2000).setVisible(false);
    this.alarmTint = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xff2020, 0)
      .setOrigin(0)
      .setDepth(1900);

    // Helmet off: a small header on the hull wall replaces the helmet HUD.
    const hullText = (y: number) =>
      this.add
        .text(this.scale.width / 2, y, '', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#e2ecff',
        })
        .setOrigin(0.5)
        .setDepth(2000);
    // Over the surface left of the bridge, so the bridge monitors stay visible.
    this.header = hullText(TILE / 2)
      .setOrigin(0, 0.5)
      .setX(6);
    this.footer = hullText((ROWS - 0.5) * TILE).setColor('#9aa4b4');
    const solo =
      store.getState().room?.players.find((p) => p.id === store.getState().playerId)?.role ===
      'solo';
    this.footer.setText(t(solo ? 'interior.controls_solo' : 'interior.controls'));
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,E') as Keys;
    this.keys.E.on('down', () => this.act());
    assistant.say(t('interior.ai.welcome'), { mood: 'happy' });
    this.events.once('shutdown', () => {
      assistant.silence();
      assistant.setAlarm(null);
      this.alarm = null;
    });
  }

  /** E key: use whatever is in reach. */
  private act(): void {
    if (this.mode === 'exiting') return;
    if (this.mode !== 'free') return this.stand();
    const prop = nearestAction(this.x, this.y);
    if (!prop) return;
    this.target = prop;
    if (prop.action === 'exit') {
      this.mode = 'exiting';
      return;
    }
    if (prop.action === 'talk') {
      const alarm = alarmFor(snaps.curr!);
      assistant.say(t(alarm ? `interior.ai.status.${alarm}` : 'interior.ai.status.clear'), {
        mood: alarm ? 'worried' : 'happy',
      });
      return;
    }
    if (prop.action === 'sleep') {
      this.mode = 'sleep';
      this.me.setPosition((prop.col + prop.w / 2) * TILE, (prop.row + 1) * TILE).setFrame(8);
      return;
    }
    this.mode = 'work';
    this.me.setFlipX((prop.col + prop.w / 2) * TILE < this.x);
  }

  private stand(): void {
    this.mode = 'free';
    this.target = null;
    this.me.setPosition(this.x, this.y);
  }

  override update(time: number, deltaMs: number): void {
    const snap = snaps.curr;
    if (!snap) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    const dx = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const dy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const moving = (dx !== 0 || dy !== 0) && this.mode !== 'exiting';
    if (moving && (this.mode === 'sleep' || this.mode === 'work')) this.stand();
    if (moving) {
      const len = Math.hypot(dx, dy);
      const next = step(this.x, this.y, (dx / len) * SPEED * dt, (dy / len) * SPEED * dt);
      this.x = next.x;
      this.y = next.y;
      if (dx !== 0) this.me.setFlipX(dx < 0);
    }

    // Body animation: same frame layout as the field (crewArt.ts).
    if (this.mode === 'sleep') this.me.setFrame(8);
    else if (this.mode === 'work') this.me.setFrame(6 + (Math.floor(time / ANIM_WORK_MS) % 2));
    else if (moving) this.me.setFrame(2 + (Math.floor(time / ANIM_WALK_MS) % 4));
    else this.me.setFrame(Math.floor(time / 600) % 2);
    if (this.mode !== 'sleep') this.me.setPosition(this.x, this.y);
    this.me.setDepth(this.me.y);
    this.zzz
      .setVisible(this.mode === 'sleep')
      .setPosition(this.me.x + 8, this.me.y - CREW_FRAME + Math.sin(time / 400) * 2);

    this.updateDoors(deltaMs);
    this.updatePrompt();
    this.updateAlarm(snap, time);
    this.screen.update(time);
    const left = Math.max(0, snap.durationS - snap.t);
    const clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    this.header.setText(
      t('interior.header', {
        clock,
        o2: Math.round((snap.lander.o2Store / snap.lander.o2StoreMax) * 100),
      }),
    );
  }

  private updateDoors(deltaMs: number): void {
    DOORS.forEach((d, i) => {
      const door = this.doors[i]!;
      const want = d.outer
        ? this.mode === 'exiting'
        : Math.hypot(this.x - d.x, this.y - d.y) < DOOR_RANGE;
      door.acc += deltaMs;
      while (door.acc >= DOOR_STEP_MS) {
        door.acc -= DOOR_STEP_MS;
        door.frame = Phaser.Math.Clamp(door.frame + (want ? 1 : -1), 0, DOOR_FRAMES - 1);
      }
      door.sprite.setFrame(door.frame);
      // The hatch is fully open: cycle out to the surface (the field scene takes over).
      if (
        d === HATCH &&
        this.mode === 'exiting' &&
        door.frame === DOOR_FRAMES - 1 &&
        !this.exitSent
      ) {
        this.exitSent = true;
        send({ t: 'eva:interact' });
      }
    });
  }

  private updatePrompt(): void {
    const prop = this.mode === 'free' ? nearestAction(this.x, this.y) : null;
    const key =
      this.mode === 'sleep' || this.mode === 'work'
        ? 'interior.prompt.stand'
        : prop
          ? `interior.prompt.${prop.action}`
          : '';
    this.prompt.setVisible(key !== '');
    if (!key) return;
    // Near the north wall the prompt would cover the AI screen: show it under the feet instead.
    const below = this.me.y - CREW_FRAME < PROMPT_TOP;
    this.prompt
      .setText(t(key))
      .setOrigin(0.5, below ? 0 : 1)
      .setPosition(
        Phaser.Math.Clamp(this.me.x, PROMPT_MARGIN, this.scale.width - PROMPT_MARGIN),
        below ? this.me.y + 4 : this.me.y - CREW_FRAME - 2,
      );
  }

  private updateAlarm(snap: NonNullable<typeof snaps.curr>, time: number): void {
    const next = alarmFor(snap);
    if (next !== this.alarm) {
      this.alarm = next;
      assistant.setAlarm(next);
      if (next) assistant.say(t(`interior.alarm.${next}`), { mood: 'alarm' });
    }
    const pulse = !prefs.getState().reduceMotion && Math.floor(time / 450) % 2 === 0;
    this.alarmTint.setFillStyle(0xff2020, this.alarm ? (pulse ? 0.16 : 0.06) : 0);
  }
}
