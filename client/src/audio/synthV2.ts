import type { SfxName } from './sounds';
import { burst, tone } from './synthNodes';
import type { Burst, Tone } from './synthNodes';
/** Procedural placeholders for every v2 cue; supplied sound files still take priority. */
export function playV2(ctx: AudioContext, out: AudioNode, name: SfxName, volume: number): boolean {
  const n = (b: Burst) => burst(ctx, out, { ...b, vol: b.vol * volume });
  const s = (o: Tone) => tone(ctx, out, { ...o, vol: o.vol * volume });
  switch (name) {
    case 'scanner_ping':
      s({ dur: 0.1, vol: 0.15, f0: 1100, f1: 850 });
      break;
    case 'discovery':
    case 'objective_done':
      [660, 990, 1320].forEach((f, i) => s({ at: i * 0.08, dur: 0.25, vol: 0.13, f0: f }));
      break;
    case 'deploy':
      n({ dur: 0.12, vol: 0.16, f0: 900, f1: 220 });
      s({ at: 0.12, dur: 0.2, vol: 0.1, f0: 700 });
      break;
    case 'repair_loop':
      n({ dur: 0.28, vol: 0.12, f0: 1200, f1: 500 });
      break;
    case 'repair_done':
      s({ dur: 0.2, vol: 0.14, f0: 660 });
      s({ at: 0.1, dur: 0.3, vol: 0.14, f0: 990 });
      break;
    case 'fault_alarm':
      s({ dur: 0.2, vol: 0.15, f0: 330 });
      s({ at: 0.22, dur: 0.2, vol: 0.15, f0: 220 });
      break;
    case 'devil_loop':
      n({ dur: 0.6, vol: 0.18, f0: 1200, f1: 500, attack: 0.1 });
      break;
    case 'panel_clean':
      n({ dur: 0.5, vol: 0.1, f0: 800, f1: 2400, attack: 0.1 });
      s({ at: 0.25, dur: 0.2, vol: 0.12, f0: 1100 });
      break;
    case 'flare_alarm':
      s({ dur: 0.45, vol: 0.15, f0: 750, f1: 1400 });
      break;
    case 'window_alarm':
      [0, 0.2, 0.4].forEach((at) => s({ at, dur: 0.12, vol: 0.15, f0: 880 }));
      break;
    case 'signal_pulse':
      s({ dur: 0.5, vol: 0.18, f0: 160, f1: 120 });
      s({ dur: 0.4, vol: 0.1, f0: 240 });
      break;
    case 'act_sting':
      s({ dur: 0.7, vol: 0.14, f0: 220, f1: 330, attack: 0.1 });
      break;
    case 'radio_earth':
      n({ dur: 0.13, vol: 0.12, f0: 2000 });
      s({ at: 0.12, dur: 0.1, vol: 0.1, f0: 1300 });
      break;
    case 'landing':
      n({ dur: 1, vol: 0.22, type: 'lowpass', f0: 1200, f1: 180, attack: 0.1 });
      break;
    case 'breath_loop':
      n({ dur: 1.8, vol: 0.07, f0: 1100, f1: 500, attack: 0.4 });
      break;
    case 'ui_hover':
      s({ dur: 0.04, vol: 0.06, f0: 800, f1: 1000 });
      break;
    default:
      return false;
  }
  return true;
}
