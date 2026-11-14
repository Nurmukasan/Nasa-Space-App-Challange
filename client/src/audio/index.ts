import { Howl } from 'howler';
import { prefs } from '../state/prefs';
import { FIELD } from '../game/style';
import { sources } from './sounds';
import type { MusicName, SfxName } from './sounds';
export type { SfxName } from './sounds';
export interface SfxOptions {
  volume?: number;
  x?: number;
  y?: number;
}
type SoundName = SfxName | MusicName;
const musicNames: MusicName[] = ['music_eva_base', 'music_eva_tension', 'music_eva_danger'];
const isMusic = (name: string) => name.startsWith('music_') || name.startsWith('sting_');
const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

class AudioManager {
  private context: AudioContext | null = null;
  private cache = new Map<SoundName, Howl | null>();
  private loops = new Map<SoundName, ReturnType<typeof setInterval> | null>();
  private tension = 0;
  private ducked = false;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;
  /** Read-only counters support browser smoke tests and effect deduplication checks. */
  readonly diagnostics = { tones: 0, oneShots: 0 };
  constructor() {
    prefs.subscribe(() => this.applyVolumes());
  }
  unlock(): void {
    if (!this.context) {
      try {
        this.context = new AudioContext();
      } catch {
        return;
      }
    }
    void this.context
      .resume()
      .then(() => {
        this.ready = true;
      })
      .catch(() => undefined);
  }
  private sound(name: SoundName): Howl | null {
    if (this.cache.has(name)) return this.cache.get(name)!;
    const src = sources(name);
    const howl = src.length
      ? new Howl({
          src,
          volume: 0,
          preload: true,
          onloaderror: () => {
            this.cache.set(name, null);
          },
        })
      : null;
    this.cache.set(name, howl);
    return howl;
  }
  private volume(name: SoundName): number {
    const p = prefs.getState();
    if (p.muted) return 0;
    if (!isMusic(name)) return p.sfxVolume;
    const layer =
      name === 'music_eva_tension'
        ? Math.min(1, this.tension * 1.5)
        : name === 'music_eva_danger'
          ? Math.max(0, (this.tension - 0.45) / 0.55)
          : 1;
    return p.musicVolume * layer * (this.ducked ? 0.7 : 1);
  }
  private tone(name: SfxName, volume: number): void {
    const ctx = this.context;
    if (!this.ready || !ctx || volume <= 0) return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const high = ['sample_get', 'refill_done', 'classify_ok', 'ui_click'].includes(name);
    const frequency = high
      ? 740
      : ['breach', 'down', 'rockfall', 'classify_bad'].includes(name)
        ? 110
        : 260;
    const duration = name === 'radio_in' ? 0.16 : 0.09;
    oscillator.type = high ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * (high ? 1.35 : 0.7),
      ctx.currentTime + duration,
    );
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * 0.12, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    this.diagnostics.tones++;
  }
  sfx(name: SfxName, opts: SfxOptions = {}): void {
    if (!this.ready) return;
    this.diagnostics.oneShots++;
    const volume = this.volume(name) * clamp(opts.volume ?? 1),
      sound = this.sound(name);
    if (sound) {
      const id = sound.play();
      sound.volume(volume, id);
    } else this.tone(name, volume);
    if (['alarm_seismic', 'tremor_loop', 'breach', 'radio_in'].includes(name)) this.duck();
  }
  loop(name: SoundName): void {
    if (!this.ready || this.loops.has(name)) return;
    const sound = this.sound(name);
    if (sound) {
      sound.loop(true);
      sound.volume(this.volume(name));
      sound.play();
      this.loops.set(name, null);
    } else if (!isMusic(name)) {
      const interval = name === 'heartbeat_loop' ? 900 : name === 'dig_loop' ? 220 : 400;
      const play = () => this.tone(name as SfxName, this.volume(name));
      play();
      this.loops.set(name, setInterval(play, interval));
    }
  }
  stop(name: SoundName): void {
    const timer = this.loops.get(name);
    if (timer) clearInterval(timer);
    this.loops.delete(name);
    this.cache.get(name)?.stop();
  }
  setTension(value: number): void {
    const next = clamp(value);
    if (Math.abs(next - this.tension) < 0.03) return;
    this.tension = next;
    this.applyVolumes();
  }
  setVolume(kind: 'music' | 'sfx', value: number): void {
    prefs.setState(kind === 'music' ? { musicVolume: clamp(value) } : { sfxVolume: clamp(value) });
  }
  mute(value: boolean): void {
    prefs.setState({ muted: value });
  }
  private applyVolumes(): void {
    for (const [name, sound] of this.cache)
      if (sound) {
        const v = this.volume(name);
        if (isMusic(name) && this.loops.has(name)) sound.fade(sound.volume(), v, FIELD.musicFadeMs);
        else sound.volume(v);
      }
  }
  private duck(): void {
    this.ducked = true;
    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.applyVolumes();
    this.duckTimer = setTimeout(() => {
      this.ducked = false;
      this.applyVolumes();
    }, 700);
  }
  startEva(): void {
    for (const name of musicNames) this.loop(name);
  }
  stopEva(): void {
    for (const name of [...this.loops.keys()]) this.stop(name);
  }
}
export const audio = new AudioManager();
