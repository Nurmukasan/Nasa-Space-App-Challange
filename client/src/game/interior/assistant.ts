// The base AI assistant: a face on the bridge screen that talks and raises alarms.
// Pure state with an explicit clock (ms), so it is testable and the scene just reads it.
//
// For dialogue scripts:   assistant.say(text, { mood: 'happy' })
// Lines queue up and play one after another; each line moves the mouth while it "types".
import type { EvaState } from '@rs/shared';

export type Mood = 'neutral' | 'happy' | 'worried' | 'alarm';
export type AlarmKind = 'quake' | 'storm' | 'flare' | 'rockfall';

export interface Line {
  text: string;
  mood: Mood;
  /** How long the line stays on screen after it finished typing, ms. */
  holdMs: number;
}

export interface Look {
  mood: Mood;
  /** 0 closed, 1 half open, 2 open. */
  mouth: 0 | 1 | 2;
  eyesClosed: boolean;
  /** Text typed so far, or null when silent. */
  text: string | null;
  alarm: AlarmKind | null;
}

/** Typing speed of a line, ms per character. */
export const TYPE_MS = 45;
const HOLD_MS = 1600;
const BLINK_EVERY_MS = 3800;
const BLINK_MS = 140;

const VOWELS = new Set('aeiouyAEIOUY'.split(''));

/** Mouth shape for the character being "spoken": vowels open, consonants half, pauses shut. */
export function mouthFor(ch: string | undefined): 0 | 1 | 2 {
  if (!ch || /[\s.,!?;:—-]/.test(ch)) return 0;
  return VOWELS.has(ch) ? 2 : 1;
}

export class Assistant {
  private queue: Line[] = [];
  private current: Line | null = null;
  private startedAt = 0;
  private alarm: AlarmKind | null = null;
  private listeners = new Set<() => void>();

  say(text: string, opts: { mood?: Mood; holdMs?: number } = {}): void {
    this.queue.push({ text, mood: opts.mood ?? 'neutral', holdMs: opts.holdMs ?? HOLD_MS });
    this.listeners.forEach((fn) => fn());
  }

  /** Drop everything that is queued or playing (for example when the astronaut leaves). */
  silence(): void {
    this.queue.length = 0;
    this.current = null;
  }

  setAlarm(kind: AlarmKind | null): void {
    this.alarm = kind;
  }

  get speaking(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  onSay(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Advance to `now` and describe what the screen shows. */
  look(now: number): Look {
    if (this.current) {
      const done = this.startedAt + this.current.text.length * TYPE_MS + this.current.holdMs;
      if (now >= done) this.current = null;
    }
    if (!this.current && this.queue.length) {
      this.current = this.queue.shift()!;
      this.startedAt = now;
    }
    const blink = !this.alarm && now % BLINK_EVERY_MS < BLINK_MS;
    if (!this.current)
      return {
        mood: this.alarm ? 'alarm' : 'neutral',
        mouth: 0,
        eyesClosed: blink,
        text: null,
        alarm: this.alarm,
      };
    const typed = Math.min(this.current.text.length, Math.floor((now - this.startedAt) / TYPE_MS));
    const typing = typed < this.current.text.length;
    return {
      mood: this.alarm && this.current.mood !== 'alarm' ? 'alarm' : this.current.mood,
      mouth: typing ? mouthFor(this.current.text[typed]) : 0,
      eyesClosed: blink,
      text: this.current.text.slice(0, typed),
      alarm: this.alarm,
    };
  }
}

export const assistant = new Assistant();

/** The most urgent danger the crew should hear about, from the public snapshot only. */
export function alarmFor(snap: EvaState): AlarmKind | null {
  const t = snap.t;
  if (snap.hazards.length > 0) return 'rockfall';
  if (snap.seismic.some((e) => e.truth === null && t >= e.t0 && t < e.deadline)) return 'quake';
  const f = snap.flare;
  if (f && t >= f.warnAt && t < f.tEnd) return 'flare';
  const storm = snap.weather.storm;
  if (storm && t < storm.tEnd) return 'storm';
  return null;
}
