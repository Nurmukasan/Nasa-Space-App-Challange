// Inside the lander. Runs on top of the field scene while our astronaut's status is 'inside'.
// Everything here is local to this player: walking, doors and room actions are cosmetic;
// the only message sent to the engine is eva:interact at the airlock terminal (go back outside).
// The room itself is interior_base.png: the team's reference picture of the base.
import Phaser from 'phaser';
import { send } from '../../net/session';
import { snaps } from '../../state/snapshots';
import { prefs } from '../../state/prefs';
import { store } from '../../state/store';
import { t } from '../../i18n';
import { crewKey } from '../crewTextures';
import { CREW_FRAME } from '../crewArt';
import { BEDS, DOORS, DOOR_H, DOOR_RANGE, DOOR_W, SPAWN, nearestAction, step } from './layout';
import type { Spot } from './layout';
import { alarmFor, assistant } from './assistant';
import { AiScreen } from './AiScreen';
import type { AlarmKind } from './assistant';

/** Walking speed inside, px/s (cosmetic: the engine does not track position indoors). */
const SPEED = 60;
/** Door leaves retract this many px each step, every DOOR_STEP_MS. */
const DOOR_STEP_MS = 30;
const DOOR_HALF = Math.floor(DOOR_W / 2);
/** Time the airlock takes to cycle before the astronaut is outside, ms. */
const AIRLOCK_MS = 900;
/** The picture is drawn this far down, leaving a strip for the header. */
const TOP = 6;
const CORE = { x: 241, y: 222, w: 10, h: 28 };
const ANIM_WALK_MS = 120;
const ANIM_WORK_MS = 260;
/** Keeps the E prompt fully on screen next to the walls, px. */
const PROMPT_MARGIN = 44;
/** Near the top rows (wall screens, ARIA) the E prompt moves under the astronaut. */
const PROMPT_TOP = 70;

type Mode = 'free' | 'sleep' | 'work' | 'exiting';
type Keys = Record<'W' | 'A' | 'S' | 'D' | 'E', Phaser.Input.Keyboard.Key>;

export class InteriorScene extends Phaser.Scene {
  private keys!: Keys;
  private me!: Phaser.GameObjects.Sprite;
  private x = SPAWN.x;
  private y = SPAWN.y;
  private mode: Mode = 'free';
  private target: Spot | null = null;
  private doors: Array<{
    left: Phaser.GameObjects.Sprite;
    right: Phaser.GameObjects.Sprite;
    open: number;
    acc: number;
  }> = [];
  private exitAt = 0;
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
    this.cameras.main.setScroll(0, -TOP);
    this.add.image(0, 0, 'interior_base').setOrigin(0).setDepth(0);
    // Each door is two leaf sprites cropped from the same frame; opening shrinks them into the wall.
    this.doors = DOORS.map((d) => {
      const leaf = () =>
        this.add
          .sprite(d.x, d.y, 'interior_doors', d.frame)
          .setOrigin(0)
          .setDepth(d.y + DOOR_H);
      return { left: leaf(), right: leaf(), open: 0, acc: 0 };
    });
    this.coreGlow = this.add
      .rectangle(CORE.x, CORE.y, CORE.w, CORE.h, 0x40c8ff, 0.7)
      .setDepth(CORE.y + CORE.h)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (!prefs.getState().reduceMotion)
      this.tweens.add({
        targets: this.coreGlow,
        alpha: 0.2,
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
    this.exitAt = 0;
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
      .setScrollFactor(0)
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
        .setScrollFactor(0)
        .setDepth(2000);
    // Over the surface either side of the bridge, so the bridge monitors stay visible.
    this.header = hullText(8).setOrigin(0, 0.5).setX(6);
    this.footer = hullText(8)
      .setOrigin(1, 0.5)
      .setX(this.scale.width - 6)
      .setColor('#9aa4b4');
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
      this.exitAt = this.time.now + AIRLOCK_MS;
      assistant.say(t('interior.ai.airlock'), { mood: 'neutral', holdMs: 400 });
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
      const bed = BEDS[prop.id] ?? { x: (prop.x0 + prop.x1) / 2, y: prop.y1 };
      this.me.setPosition(bed.x, bed.y).setFrame(8);
      return;
    }
    this.mode = 'work';
    this.me.setFlipX((prop.x0 + prop.x1) / 2 < this.x);
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
    if (this.mode === 'exiting' && !this.exitSent && time >= this.exitAt) {
      this.exitSent = true;
      send({ t: 'eva:interact' });
    }
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
      const cx = d.x + DOOR_W / 2,
        cy = d.y + DOOR_H / 2;
      const want = Math.hypot(this.x - cx, this.y - cy) < DOOR_RANGE;
      door.acc += deltaMs;
      while (door.acc >= DOOR_STEP_MS) {
        door.acc -= DOOR_STEP_MS;
        door.open = Phaser.Math.Clamp(door.open + (want ? 2 : -2), 0, DOOR_HALF - 1);
      }
      const w = DOOR_HALF - door.open;
      door.left.setCrop(0, 0, w, DOOR_H);
      door.right.setCrop(DOOR_W - w, 0, w, DOOR_H);
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
