// Inside the lander. Runs on top of the field scene while our astronaut's status is 'inside'.
// The room is the team's picture at full resolution (InteriorView, DOM above the canvas); this
// scene owns input and the room logic. Walking, doors and room actions are local and cosmetic;
// the only message sent to the engine is eva:interact at the airlock terminal (go back outside).
import Phaser from 'phaser';
import type { CrewClassId } from '@rs/shared';
import { send } from '../../net/session';
import { snaps } from '../../state/snapshots';
import { prefs } from '../../state/prefs';
import { store } from '../../state/store';
import { t } from '../../i18n';
import { CREW_FRAME } from '../crewArt';
import { crewCanvas } from '../crewTextures';
import { BEDS, DOORS, DOOR_H, DOOR_RANGE, DOOR_W, SPAWN, nearestAction, step } from './layout';
import { alarmFor, assistant } from './assistant';
import type { AlarmKind } from './assistant';
import { AiScreen } from './AiScreen';
import { FACE_H, FACE_W, FACE_X, FACE_Y } from './interiorProps';
import { HD, InteriorView, VIEW, pictures } from './InteriorView';

/** Walking speed inside, px/s of the 480-px layout (the engine does not track it). */
const SPEED = 60;
const DOOR_STEP_MS = 30;
const DOOR_HALF = Math.floor(DOOR_W / 2);
/** Door leaves in doors.webp: three frames of this size, in DOORS order. */
const LEAF_W = 130;
const LEAF_H = 110;
const AIRLOCK_MS = 900;
const ANIM_WALK_MS = 120;
const ANIM_WORK_MS = 260;
/** Astronaut origin: boots sit just below the feet point (same as the field). */
const ORIGIN_Y = 0.9;
/** Above this line (layout px) the E prompt moves under the astronaut, clear of ARIA. */
const PROMPT_TOP = 70;
const CORE = { x: 241, y: 222, w: 10, h: 28 };
const PROMPT = { color: '#e2ecff', background: 'rgba(16,26,40,0.85)' };
const SUBTITLE = { color: '#9af7f0', background: 'rgba(16,26,40,0.9)' };
const HULL = { color: '#e2ecff', textShadow: '0 1px 2px #000' };
const DIM = { ...HULL, color: '#9aa4b4' };

type Mode = 'free' | 'sleep' | 'work' | 'exiting';
type Keys = Record<'W' | 'A' | 'S' | 'D' | 'E', Phaser.Input.Keyboard.Key>;

export class InteriorScene extends Phaser.Scene {
  private keys!: Keys;
  private view!: InteriorView;
  private face = new AiScreen();
  private crew: CrewClassId = 'engineer';
  private x = SPAWN.x;
  private y = SPAWN.y;
  private flip = false;
  private frame = 0;
  private mode: Mode = 'free';
  private bed: { x: number; y: number } | null = null;
  private doors = DOORS.map(() => ({ open: 0, acc: 0 }));
  private alarm: AlarmKind | null = null;
  private exitAt = 0;
  private exitSent = false;
  private solo = false;

  constructor() {
    super('interior');
  }

  create(): void {
    const st = store.getState();
    this.crew = snaps.curr?.astronauts.find((a) => a.id === st.playerId)?.crewClass ?? 'engineer';
    this.solo = st.room?.players.find((p) => p.id === st.playerId)?.role === 'solo';
    this.x = SPAWN.x;
    this.y = SPAWN.y;
    this.mode = 'free';
    this.bed = null;
    this.exitAt = 0;
    this.exitSent = false;
    this.doors = DOORS.map(() => ({ open: 0, acc: 0 }));
    this.view = new InteriorView(this.game.canvas);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,E') as Keys;
    this.keys.E.on('down', () => this.act());
    assistant.say(t('interior.ai.welcome'), { mood: 'happy' });
    this.events.once('shutdown', () => {
      this.view.destroy();
      assistant.silence();
      assistant.setAlarm(null);
      this.alarm = null;
    });
  }

  /** E key: use whatever is in reach. */
  private act(): void {
    if (this.mode === 'exiting') return;
    if (this.mode !== 'free') return this.stand();
    const spot = nearestAction(this.x, this.y);
    if (!spot) return;
    if (spot.action === 'exit') {
      this.mode = 'exiting';
      this.exitAt = this.time.now + AIRLOCK_MS;
      assistant.say(t('interior.ai.airlock'), { holdMs: 400 });
    } else if (spot.action === 'talk') {
      const alarm = alarmFor(snaps.curr!);
      assistant.say(t(alarm ? `interior.ai.status.${alarm}` : 'interior.ai.status.clear'), {
        mood: alarm ? 'worried' : 'happy',
      });
    } else if (spot.action === 'sleep') {
      this.mode = 'sleep';
      this.bed = BEDS[spot.id] ?? { x: (spot.x0 + spot.x1) / 2, y: spot.y1 };
    } else {
      this.mode = 'work';
      this.flip = (spot.x0 + spot.x1) / 2 < this.x;
    }
  }

  private stand(): void {
    this.mode = 'free';
    this.bed = null;
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
      if (dx !== 0) this.flip = dx < 0;
    }
    // Same frame layout as the field (crewArt.ts).
    if (this.mode === 'sleep') this.frame = 8;
    else if (this.mode === 'work') this.frame = 6 + (Math.floor(time / ANIM_WORK_MS) % 2);
    else if (moving) this.frame = 2 + (Math.floor(time / ANIM_WALK_MS) % 4);
    else this.frame = Math.floor(time / 600) % 2;
    this.stepDoors(deltaMs);
    if (this.mode === 'exiting' && !this.exitSent && time >= this.exitAt) {
      this.exitSent = true;
      send({ t: 'eva:interact' });
    }
    const next = alarmFor(snap);
    if (next !== this.alarm) {
      this.alarm = next;
      assistant.setAlarm(next);
      if (next) assistant.say(t(`interior.alarm.${next}`), { mood: 'alarm' });
    }
    this.face.update(time);
    this.view.sync(time);
    this.draw(time);
    this.texts(snap, time);
  }

  private stepDoors(deltaMs: number): void {
    DOORS.forEach((d, i) => {
      const door = this.doors[i]!;
      const cx = d.x + DOOR_W / 2,
        cy = d.y + DOOR_H / 2;
      const near = Math.hypot(this.x - cx, this.y - cy) < DOOR_RANGE;
      door.acc += deltaMs;
      while (door.acc >= DOOR_STEP_MS) {
        door.acc -= DOOR_STEP_MS;
        door.open = Phaser.Math.Clamp(door.open + (near ? 2 : -2), 0, DOOR_HALF - 1);
      }
    });
  }

  /** Paint doors, core glow, ARIA's face and the astronaut onto the full-resolution canvas. */
  private draw(time: number): void {
    const g = this.view.ctx;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    const reduce = prefs.getState().reduceMotion;
    if (pictures.doors.complete) DOORS.forEach((d, i) => this.drawDoor(g, d, this.doors[i]!.open));
    const glow = reduce ? 0.45 : 0.3 + 0.25 * Math.sin(time / 300);
    g.fillStyle = `rgba(64, 200, 255, ${glow.toFixed(2)})`;
    g.fillRect((CORE.x - CORE.w / 2) * HD, (CORE.y - CORE.h / 2) * HD, CORE.w * HD, CORE.h * HD);
    g.drawImage(this.face.canvas, FACE_X * HD, FACE_Y * HD, FACE_W * HD, FACE_H * HD);
    // The astronaut: the 24-px crew frame scaled to the picture, mirrored when walking left.
    const at = this.bed ?? { x: this.x, y: this.y };
    const size = CREW_FRAME * HD;
    g.save();
    g.translate(at.x * HD, at.y * HD - size * ORIGIN_Y);
    if (this.flip) g.scale(-1, 1);
    g.drawImage(
      crewCanvas(this.crew),
      this.frame * CREW_FRAME,
      0,
      CREW_FRAME,
      CREW_FRAME,
      -size / 2,
      0,
      size,
      size,
    );
    g.restore();
    this.view.setAlarm(this.alarm ? (reduce ? 0.1 : 0.1 + 0.06 * Math.sin(time / 140)) : 0);
  }

  /** Each door leaf keeps its outer edge and loses width as it slides into the wall. */
  private drawDoor(g: CanvasRenderingContext2D, d: (typeof DOORS)[number], open: number): void {
    const k = (DOOR_HALF - open) / DOOR_W;
    if (k <= 0) return;
    const sx = d.frame * LEAF_W,
      x = d.x * HD,
      y = d.y * HD,
      w = DOOR_W * HD,
      h = DOOR_H * HD;
    g.drawImage(pictures.doors, sx, 0, LEAF_W * k, LEAF_H, x, y, w * k, h);
    g.drawImage(
      pictures.doors,
      sx + LEAF_W * (1 - k),
      0,
      LEAF_W * k,
      LEAF_H,
      x + w * (1 - k),
      y,
      w * k,
      h,
    );
  }

  private texts(snap: NonNullable<typeof snaps.curr>, time: number): void {
    const v = this.view;
    const left = Math.max(0, snap.durationS - snap.t);
    const clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const o2 = Math.round((snap.lander.o2Store / snap.lander.o2StoreMax) * 100);
    v.label('header', { text: t('interior.header', { clock, o2 }), x: 4, y: 3 }, HULL, false, '');
    const controls = t(this.solo ? 'interior.controls_solo' : 'interior.controls');
    v.label('footer', { text: controls, x: VIEW.w - 4, y: 3 }, DIM, false, 'translate(-100%, 0)');
    const spot = this.mode === 'free' ? nearestAction(this.x, this.y) : null;
    const busy = this.mode === 'sleep' || this.mode === 'work';
    const key = busy ? 'interior.prompt.stand' : spot ? `interior.prompt.${spot.action}` : '';
    const below = this.y - CREW_FRAME < PROMPT_TOP;
    const py = below ? this.y + 4 : this.y - CREW_FRAME - 2;
    const anchor = below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    v.label('prompt', key ? { text: t(key), x: this.x, y: py } : null, PROMPT, true, anchor);
    const zzz =
      this.mode === 'sleep' && this.bed
        ? { text: 'Z z', x: this.bed.x + 10, y: this.bed.y - 18 + Math.sin(time / 400) * 2 }
        : null;
    v.label('zzz', zzz, { color: '#e2ecff' }, true, '');
    const line = this.face.text ? `${t('interior.ai.name')}: ${this.face.text}` : null;
    const sub = line ? { text: line, x: VIEW.w / 2, y: VIEW.h - 8 } : null;
    v.label('subtitle', sub, SUBTITLE, false, 'translate(-50%, -100%)');
  }
}
