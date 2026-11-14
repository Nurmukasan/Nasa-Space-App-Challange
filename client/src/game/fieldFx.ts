import type Phaser from 'phaser';
import { O2 } from '@rs/shared';
import type { EvaState, FxEvent, FxType } from '@rs/shared';
import { audio } from '../audio';
import type { SfxName } from '../audio';
import { fxBus } from '../fx/FxBus';
import { prefs } from '../state/prefs';
import { evaText as t } from '../i18n/en/eva';
import { FIELD } from './style';

const SOUNDS: Partial<Record<FxType, SfxName>> = {
  tremor: 'tremor_loop',
  sample: 'sample_get',
  deposit: 'deposit',
  down: 'down',
  ping: 'radio_in',
  refill: 'refill_done',
  breach: 'breach',
  rescue: 'classify_ok',
  lost: 'down',
  classify_ok: 'classify_ok',
  classify_bad: 'classify_bad',
  rockfall: 'rockfall',
  fireball: 'fireball',
  impact: 'impact',
  alert: 'radio_in',
  storm_start: 'tremor_loop',
};

/** All listeners are released with the scene; effect IDs are consumed by the session. */
export class FieldFx {
  private dispose: Array<() => void> = [];
  private count = 0;
  private snap: EvaState | null = null;
  private myId = '';
  private wasLaunched = false;
  private logId = 0;
  private musicStarted = false;
  constructor(private scene: Phaser.Scene) {
    for (const type of Object.keys(SOUNDS) as FxType[])
      this.dispose.push(fxBus.on(type, (e) => this.effect(e)));
    scene.events.once('shutdown', () => {
      this.dispose.forEach((fn) => fn());
      audio.stopEva();
    });
  }
  private effect(event: FxEvent): void {
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
      (event.type === 'tremor' || event.type === 'impact' || event.type === 'rockfall') &&
      !reduce
    )
      this.scene.cameras.main.shake(350, Math.max(0.001, 0.006 * (1 - distance / 1400)));
    const a = this.snap?.astronauts.find((a) => a.id === event.playerId);
    const x = event.x ?? a?.x ?? mine?.x ?? 0,
      y = event.y ?? a?.y ?? mine?.y ?? 0;
    if (event.type === 'sample') {
      this.float(x, y, `+${event.n ?? 0}`, '#ffce72', reduce);
      if (!reduce) this.scene.cameras.main.flash(80, 255, 210, 110, false);
    } else if (event.type === 'deposit')
      this.float(x, y, `+${event.n ?? 0} ${t('eva.samples')}`, '#50e6f0', reduce);
    else if (event.type === 'down') this.float(x, y, t('eva.ping.help'), '#f0463c', reduce);
    else if (event.type === 'ping' && (!a || a.linked))
      this.float(x, y, t(`eva.ping.${event.s ?? 'ok'}`), '#e2ecff', reduce);
    else if (event.type === 'breach') this.float(x, y, t('eva.breach'), '#ffb030', reduce);
    if (event.type === 'fireball' && !reduce) {
      const meteor = this.scene.add
        .rectangle(x - 200, y - 130, 45, 2, FIELD.gold)
        .setRotation(0.5)
        .setDepth(1400);
      this.scene.tweens.add({
        targets: meteor,
        x,
        y,
        duration: 750,
        onComplete: () => meteor.destroy(),
      });
    }
  }
  private float(x: number, y: number, text: string, color: string, reduce: boolean): void {
    const label = this.scene.add
      .text(x, y - 20, text, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color,
        stroke: '#161222',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(1350);
    if (reduce) this.scene.time.delayedCall(FIELD.fxDurationMs, () => label.destroy());
    else
      this.scene.tweens.add({
        targets: label,
        y: y - 40,
        alpha: 0,
        duration: FIELD.fxDurationMs,
        onComplete: () => label.destroy(),
      });
  }
  update(snap: EvaState, myId: string): void {
    this.snap = snap;
    this.myId = myId;
    const mine = snap.astronauts.find((a) => a.id === myId);
    if (!mine) return;
    if (!this.wasLaunched && snap.t >= 0) {
      audio.sfx('launch');
      this.wasLaunched = true;
    }
    if (!this.musicStarted) {
      audio.startEva();
      this.musicStarted = true;
    }
    const low = mine.o2 / mine.o2Max < O2.lowFrac && mine.status === 'active';
    if (low) audio.loop('heartbeat_loop');
    else audio.stop('heartbeat_loop');
    if (mine.digging) audio.loop('dig_loop');
    else audio.stop('dig_loop');
    if (mine.wantsRefill && (!snap.lander.ration || mine.refillGranted)) audio.loop('refill_loop');
    else audio.stop('refill_loop');
    const latest = snap.log.at(-1);
    if (latest && latest.id !== this.logId) {
      this.logId = latest.id;
      if (mine.linked) audio.sfx('radio_in');
    }
    const unresolved = snap.seismic.some((e) => e.truth === null);
    const danger =
      mine.o2 / mine.o2Max < 0.2 || snap.t < mine.dangerUntil || snap.durationS - snap.t < 60;
    audio.setTension(
      danger ? 1 : unresolved || mine.o2 / mine.o2Max < 0.4 ? 0.65 : 1 - snap.weather.light,
    );
  }
}
