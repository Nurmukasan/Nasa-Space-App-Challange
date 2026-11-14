import type { SfxName } from './sounds';
import { burst, tone } from './synthNodes';
import type { Burst, Tone } from './synthNodes';

/** Debrief stamps and the death sting. Split from synth.ts to keep files small. */
export function playEnding(ctx: AudioContext, out: AudioNode, name: SfxName, v: number): boolean {
  const n = (o: Burst) => burst(ctx, out, { ...o, vol: o.vol * v });
  const s = (o: Tone) => tone(ctx, out, { ...o, vol: o.vol * v });
  switch (name) {
    case 'stamp_win':
      // Heavy thunk, then a bright rising chord and a shimmer: mission accepted.
      s({ dur: 0.22, vol: 0.7, type: 'triangle', f0: 150, f1: 55 });
      n({ dur: 0.1, vol: 0.5, type: 'bandpass', f0: 1400, q: 1.2 });
      [392, 494, 587, 784].forEach((f, i) => {
        s({ at: 0.18 + i * 0.09, dur: 1.6, vol: 0.2, type: 'triangle', f0: f, attack: 0.02 });
        s({ at: 0.18 + i * 0.09, dur: 1.2, vol: 0.08, f0: f * 2 });
      });
      n({ at: 0.3, dur: 1.4, vol: 0.14, type: 'highpass', f0: 5500, f1: 8000, attack: 0.3 });
      return true;
    case 'stamp_fail':
      // Same thunk, then a sinking minor cluster and a slow low drone: mission failed.
      s({ dur: 0.3, vol: 0.8, type: 'triangle', f0: 120, f1: 38 });
      n({ dur: 0.14, vol: 0.5, type: 'lowpass', f0: 900, f1: 150 });
      [196, 233, 277].forEach((f, i) => {
        s({ at: 0.2 + i * 0.12, dur: 2.2, vol: 0.2, type: 'sawtooth', f0: f, f1: f * 0.8 });
      });
      s({ at: 0.2, dur: 2.6, vol: 0.4, f0: 55, f1: 36, attack: 0.15 });
      n({ at: 0.2, dur: 2, vol: 0.2, type: 'lowpass', f0: 300, f1: 70, attack: 0.4 });
      return true;
    case 'death':
      // Suit failure: last breath hiss, two slowing heartbeats, a drop, then a long flatline.
      n({ dur: 0.7, vol: 0.4, type: 'highpass', f0: 5000, f1: 1500, attack: 0.05 });
      s({ at: 0.1, dur: 0.16, vol: 0.7, f0: 60, f1: 38 });
      s({ at: 0.4, dur: 0.2, vol: 0.6, f0: 54, f1: 34 });
      s({ at: 0.95, dur: 0.26, vol: 0.5, f0: 48, f1: 30 });
      s({ at: 0.3, dur: 1.4, vol: 0.28, type: 'sawtooth', f0: 330, f1: 40, attack: 0.05 });
      s({ at: 1.5, dur: 1.9, vol: 0.18, f0: 880, attack: 0.04 });
      s({ at: 1.5, dur: 1.9, vol: 0.06, f0: 1320, attack: 0.04 });
      n({ at: 1.2, dur: 1.2, vol: 0.25, type: 'lowpass', f0: 250, f1: 60, attack: 0.2 });
      return true;
    default:
      return false;
  }
}
