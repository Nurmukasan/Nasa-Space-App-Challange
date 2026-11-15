// Inside the lander. Runs on top of the field scene while our astronaut's status is 'inside'.
// The room is the tile map data/base.tmj (built from the team's tileset and base reference),
// drawn at full resolution by InteriorView; this scene owns input and the room logic. Walking,
// doors and room actions are local and cosmetic: the only message sent to the engine is
// eva:interact at the airlock terminal in the hall (go back outside).
import Phaser from 'phaser';
import type { CrewClassId } from '@rs/shared';
import { send } from '../../net/session';
import { snaps } from '../../state/snapshots';
import { prefs } from '../../state/prefs';
import { store } from '../../state/store';
import { t } from '../../i18n';
import { CREW_FRAME } from '../crewArt';
import { crewCanvas } from '../crewTextures';
import { ATLAS, DOORS, PROPS, SPAWN, nearestAction, step } from './baseMap';
import type { MapProp } from './baseMap';
import { alarmFor, assistant } from './assistant';
import type { AlarmKind } from './assistant';
import { AiScreen } from './AiScreen';
import { AI_SCREEN } from './interiorProps';
import { InteriorView, drawSprite, picturesReady } from './InteriorView';

/** Walking speed inside, map px/s (the engine does not track it). */
const SPEED = 240;
/** The 24-px crew frame is drawn this many times larger on the 64-px tile map. */
const CREW_SCALE = 4;
const DOOR_STEP_MS = 30;
const DOOR_RANGE = 110;
const AIRLOCK_MS = 900;
const ANIM_WALK_MS = 120;
const ANIM_WORK_MS = 260;
/** Astronaut origin: boots sit just below the feet point (same as the field). */
const ORIGIN_Y = 0.92;
/** Above this line (map px) the E prompt moves under the astronaut, clear of wall screens. */
const PROMPT_TOP = 320;
const PROMPT = { color: '#e2ecff', background: 'rgba(16,26,40,0.85)' };
const SUBTITLE = { color: '#9af7f0', background: 'rgba(16,26,40,0.9)' };
const HULL = { color: '#e2ecff', textShadow: '0 1px 2px #000' };
const DIM = { ...HULL, color: '#9aa4b4' };
const ARIA = PROPS.find((p) => p.action === 'talk')!;
const SOLID = PROPS.filter((p) => !p.overlay).sort((a, b) => base(a) - base(b));
const OVERLAY = PROPS.filter((p) => p.overlay);
const DOOR_W = ATLAS.wall_door?.w ?? 0;

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
  /** Px each door's leaves have slid into the wall. */
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
    const p = nearestAction(this.x, this.y);
    if (!p) return;
    if (p.action === 'exit') {
      this.mode = 'exiting';
      this.exitAt = this.time.now + AIRLOCK_MS;
      assistant.say(t('interior.ai.airlock'), { holdMs: 400 });
    } else if (p.action === 'talk') {
      const alarm = alarmFor(snaps.curr!);
      assistant.say(t(alarm ? `interior.ai.status.${alarm}` : 'interior.ai.status.clear'), {
        mood: alarm ? 'worried' : 'happy',
      });
    } else if (p.action === 'sleep') {
      this.mode = 'sleep';
      this.bed = { x: p.x + p.w / 2, y: p.y + p.h * 0.75 };
    } else {
      this.mode = 'work';
      this.flip = p.x + p.w / 2 < this.x;
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
    this.view.paintBase();
    if (picturesReady()) this.draw(time);
    this.texts(snap, time);
  }

  private stepDoors(deltaMs: number): void {
    DOORS.forEach((d, i) => {
      const door = this.doors[i]!;
      const near = Math.hypot(this.x - (d.x + d.w / 2), this.y - (d.y + d.h / 2)) < DOOR_RANGE;
      door.acc += deltaMs;
      while (door.acc >= DOOR_STEP_MS) {
        door.acc -= DOOR_STEP_MS;
        door.open = Phaser.Math.Clamp(door.open + (near ? 6 : -6), 0, DOOR_W / 2);
      }
    });
  }

  /** Props and the astronaut sorted by their base, then doors and the overlay layer on top. */
  private draw(time: number): void {
    const g = this.view.ctx;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    const me = this.bed ?? { x: this.x, y: this.y };
    let drawnMe = false;
    for (const p of SOLID) {
      if (!drawnMe && base(p) > me.y) {
        this.drawMe(g, me);
        drawnMe = true;
      }
      drawSprite(g, p.sprite, p.x, p.y);
      if (p === ARIA) this.drawFace(g);
    }
    if (!drawnMe) this.drawMe(g, me);
    // Door leaves retract into the wall: each half keeps its outer edge and loses width.
    DOORS.forEach((d, i) => {
      const half = DOOR_W / 2,
        open = this.doors[i]!.open;
      drawSprite(g, 'wall_door', d.x, d.y, { from: 0, width: half - open });
      drawSprite(g, 'wall_door', d.x, d.y, { from: half + open, width: half - open });
    });
    for (const p of OVERLAY) drawSprite(g, p.sprite, p.x, p.y);
    const reduce = prefs.getState().reduceMotion;
    this.view.setAlarm(this.alarm ? (reduce ? 0.1 : 0.1 + 0.06 * Math.sin(time / 140)) : 0);
  }

  private drawFace(g: CanvasRenderingContext2D): void {
    const s = AI_SCREEN;
    g.drawImage(this.face.canvas, ARIA.x + s.dx, ARIA.y + s.dy, s.w, s.h);
  }

  /** The astronaut: the 24-px crew frame scaled to the map, mirrored when walking left. */
  private drawMe(g: CanvasRenderingContext2D, at: { x: number; y: number }): void {
    const size = CREW_FRAME * CREW_SCALE;
    g.save();
    g.translate(at.x, at.y - size * ORIGIN_Y);
    if (this.flip) g.scale(-1, 1);
    const src = crewCanvas(this.crew);
    g.drawImage(src, this.frame * CREW_FRAME, 0, CREW_FRAME, CREW_FRAME, -size / 2, 0, size, size);
    g.restore();
  }

  private texts(snap: NonNullable<typeof snaps.curr>, time: number): void {
    const v = this.view;
    const left = Math.max(0, snap.durationS - snap.t);
    const clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const o2 = Math.round((snap.lander.o2Store / snap.lander.o2StoreMax) * 100);
    v.label('header', { text: t('interior.header', { clock, o2 }), x: 4, y: 3 }, HULL, false, '');
    const controls = t(this.solo ? 'interior.controls_solo' : 'interior.controls');
    v.label('footer', { text: controls, x: 476, y: 3 }, DIM, false, 'translate(-100%, 0)');
    const near = this.mode === 'free' ? nearestAction(this.x, this.y) : null;
    const busy = this.mode === 'sleep' || this.mode === 'work';
    const key = busy ? 'interior.prompt.stand' : near ? `interior.prompt.${near.action}` : '';
    const head = CREW_FRAME * CREW_SCALE * ORIGIN_Y;
    const below = this.y - head < PROMPT_TOP;
    const py = below ? this.y + 12 : this.y - head - 4;
    const anchor = below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    v.label('prompt', key ? { text: t(key), x: this.x, y: py } : null, PROMPT, true, anchor);
    const zzz =
      this.mode === 'sleep' && this.bed
        ? { text: 'Z z', x: this.bed.x + 30, y: this.bed.y - 70 + Math.sin(time / 400) * 6 }
        : null;
    v.label('zzz', zzz, { color: '#e2ecff' }, true, '');
    const line = this.face.text ? `${t('interior.ai.name')}: ${this.face.text}` : null;
    const sub = line ? { text: line, x: 240, y: 262 } : null;
    v.label('subtitle', sub, SUBTITLE, false, 'translate(-50%, -100%)');
  }
}

/** Depth of a prop: the bottom of its base (or of the sprite when it has none). */
function base(p: MapProp): number {
  return p.foot ? p.foot.y1 : p.y + p.h;
}
