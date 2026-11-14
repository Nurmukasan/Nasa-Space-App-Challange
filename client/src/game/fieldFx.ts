import type Phaser from 'phaser';
import { O2, RETURN, returnCost } from '@rs/shared';
import type { EvaState, FxEvent, FxType } from '@rs/shared';
import { audio } from '../audio';
import type { SfxName } from '../audio';
import { fxBus } from '../fx/FxBus';
import { prefs } from '../state/prefs';
import { evaText as t } from '../i18n/en/eva';
import { store } from '../state/store';
import { FIELD } from './style';
import { worldLabels } from './WorldLabels';

const EVENT_NOTE_MS = 5500;

const SOUNDS: Partial<Record<FxType, SfxName>> = {
  tremor: 'tremor_loop',
  sample: 'sample_get',
  deposit: 'deposit',
  down: 'death',
  ping: 'radio_in',
  refill: 'refill_done',
  breach: 'breach',
  rescue: 'classify_ok',
  lost: 'death',
  classify_ok: 'classify_ok',
  classify_bad: 'classify_bad',
  rockfall: 'rockfall',
  fireball: 'fireball',
  impact: 'impact',
  alert: 'radio_in',
  storm_start: 'tremor_loop',
  deploy: 'deploy',
  signal_pulse: 'signal_pulse',
  discovery: 'discovery',
  repair_done: 'repair_done',
  fault: 'fault_alarm',
  flare_warn: 'flare_alarm',
  window_closing: 'window_alarm',
  objective_done: 'objective_done',
  act: 'act_sting',
  panel_clean: 'panel_clean',
};

/** All listeners are released with the scene; effect IDs are consumed by the session. */
export class FieldFx {
  private dispose: Array<() => void> = [];
  private count = 0;
  private snap: EvaState | null = null;
  private myId = '';
  private wasLaunched = false;
  private sawCountdown = false;
  private logId = 0;
  private musicStarted = false;
  constructor(private scene: Phaser.Scene) {
    for (const type of Object.keys(SOUNDS) as FxType[])
      this.dispose.push(fxBus.on(type, (e) => this.effect(e)));
    const cleanup = () => {
      scene.events.off('shutdown', cleanup);
      scene.events.off('destroy', cleanup);
      for (const off of this.dispose) off();
      this.dispose.length = 0;
      audio.stopEva();
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
  }
  private effect(event: FxEvent): void {
    if (event.type === 'signal_pulse' && event.playerId && event.playerId !== this.myId) return;
    const reduce = prefs.getState().reduceMotion;
    const mine = this.snap?.astronauts.find((a) => a.id === this.myId);
    const distance =
      mine && event.x !== undefined && event.y !== undefined
        ? Math.hypot(mine.x - event.x, mine.y - event.y)
        : 0;
    const sound = SOUNDS[event.type];
    if (sound) audio.sfx(sound, { volume: Math.max(0.15, 1 - distance / 1400) });
    this.scene.registry.set('fxCount', ++this.count);
    if (
      (event.type === 'tremor' ||
        event.type === 'impact' ||
        event.type === 'rockfall' ||
        event.type === 'signal_pulse') &&
      !reduce
    ) {
      const strength =
        event.type === 'signal_pulse'
          ? Math.min(1, event.n ?? 0.5)
          : Math.max(0, 1 - distance / FIELD.shakeRangePx);
      if (strength > 0)
        this.scene.cameras.main.shake(event.type === 'tremor' ? 2600 : 900, 0.006 * strength);
    }
    const a = this.snap?.astronauts.find((a) => a.id === event.playerId);
    const x = event.x ?? a?.x ?? mine?.x ?? 0,
      y = event.y ?? a?.y ?? mine?.y ?? 0;
    if (event.type === 'deploy') {
      const kit = this.scene.add.image(x, y, 'station_kit').setDepth(y + 1);
      if (reduce) this.scene.time.delayedCall(FIELD.fxDurationMs, () => kit.destroy());
      else {
        kit.setY(y - 12);
        this.scene.tweens.add({
          targets: kit,
          y,
          alpha: 0,
          duration: FIELD.fxDurationMs,
          onComplete: () => kit.destroy(),
        });
      }
    }
    if (event.type === 'sample') {
      if (!reduce) this.scene.cameras.main.flash(80, 255, 210, 110, false);
    } else if (event.type === 'deposit')
      this.float(x, y, `+${event.n ?? 0} ${t('eva.samples')}`, '#50e6f0', reduce);
    else if (event.type === 'down') this.float(x, y, t('eva.ping.help'), '#f0463c', reduce);
    else if (event.type === 'ping' && (!a || a.linked))
      this.float(x, y, t(`eva.ping.${event.s ?? 'ok'}`), '#e2ecff', reduce);
    else if (event.type === 'breach') this.float(x, y, t('eva.breach'), '#ffb030', reduce);
    this.callout(event, x, y);
    if (event.type === 'discovery') {
      if (!reduce) this.scene.cameras.main.flash(100, 120, 255, 190, false);
      this.float(x, y, t('eva.discovery_found', { id: event.s ?? '' }), '#a4ec9c', reduce);
    }
  }

  /** Say what is happening, where, so nobody has to guess what the bang was. */
  private callout(event: FxEvent, x: number, y: number): void {
    const kinds: Partial<Record<FxType, string>> = {
      fireball: '#ffb030',
      impact: '#ff8a30',
      rockfall: '#ff6a58',
    };
    const color = kinds[event.type];
    if (!color || event.x === undefined) return;
    worldLabels(this.scene).note(
      x,
      y - 28,
      t(`eva.fx.${event.type}`),
      t(`eva.fx.${event.type}_note`),
      color,
      event.type === 'fireball' ? 2600 : EVENT_NOTE_MS,
    );
  }
  private float(x: number, y: number, text: string, color: string, reduce: boolean): void {
    worldLabels(this.scene).float(x, y - 20, text, color);
    void reduce;
  }
  private lastX = NaN;
  private lastY = NaN;
  private stride = 0;
  private lastStepAt = 0;
  /** One footstep per STRIDE_PX walked, so running sounds faster than walking. */
  private footsteps(x: number, y: number, active: boolean): void {
    const moved = Number.isNaN(this.lastX) ? 0 : Math.hypot(x - this.lastX, y - this.lastY);
    this.lastX = x;
    this.lastY = y;
    if (!active || moved <= 0 || moved > 40) return;
    this.stride += moved;
    const now = performance.now();
    if (this.stride >= FIELD.footStridePx && now - this.lastStepAt > 120) {
      this.stride = 0;
      this.lastStepAt = now;
      audio.step();
    }
  }
  update(snap: EvaState, myId: string): void {
    this.snap = snap;
    this.myId = myId;
    const mine = snap.astronauts.find((a) => a.id === myId);
    if (!mine) return;
    if (snap.t < 0) this.sawCountdown = true;
    if (!this.wasLaunched && snap.t >= 0) {
      if (this.sawCountdown) {
        audio.sfx('landing');
        if (!prefs.getState().reduceMotion) this.scene.cameras.main.shake(220, 0.003);
      }
      this.wasLaunched = true;
    }
    if (!this.musicStarted) {
      audio.startEva();
      this.musicStarted = true;
    }
    this.footsteps(mine.x, mine.y, mine.status === 'active');
    const storm = snap.weather.storm;
    audio.setStorm(storm && snap.t >= storm.tStart && snap.t < storm.tEnd ? 1 : 0);
    if (mine.status === 'active' && snap.t >= 0) audio.loop('breath_loop');
    else audio.stop('breath_loop');
    if (mine.repairing) audio.loop('repair_loop');
    else audio.stop('repair_loop');
    const low = mine.o2 / mine.o2Max < O2.lowFrac && mine.status === 'active';
    if (low) audio.loop('heartbeat_loop');
    else audio.stop('heartbeat_loop');
    if (mine.digging && !mine.repairing) audio.loop('dig_loop');
    else audio.stop('dig_loop');
    if (mine.wantsRefill && (!snap.lander.ration || mine.refillGranted)) audio.loop('refill_loop');
    else audio.stop('refill_loop');
    const latest = snap.log.at(-1);
    if (latest && latest.id !== this.logId) {
      this.logId = latest.id;
      if (mine.linked) audio.sfx(latest.from === 'earth' ? 'radio_earth' : 'radio_in');
    }
    const inDevil = snap.devils.some(
      (d) => snap.t < d.until && Math.hypot(mine.x - d.x, mine.y - d.y) <= d.r,
    );
    if (inDevil && mine.status === 'active') audio.loop('devil_loop');
    else audio.stop('devil_loop');
    const unresolved = snap.seismic.some((e) => e.truth === null);
    const params = store.getState().room?.params;
    const returnNow =
      params && mine.o2 < returnCost(params, snap.weather, mine.x, mine.y) + RETURN.warningUnits;
    const danger =
      returnNow ||
      mine.o2 / mine.o2Max < 0.2 ||
      snap.t < mine.dangerUntil ||
      snap.durationS - snap.t < 60;
    audio.setTension(
      danger ? 1 : unresolved || mine.o2 / mine.o2Max < 0.4 ? 0.65 : 1 - snap.weather.light,
    );
  }
}
