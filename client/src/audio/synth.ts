import type { SfxName } from './sounds';

/**
 * Procedural Mars sound set. No audio files ship with the repo, so every effect is built from
 * oscillators and filtered noise. Real .ogg/.wav files in public/assets/audio still win.
 */
type Ctx = AudioContext;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: Ctx): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  // Slightly brown noise: less hiss, more dusty rumble.
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.06 * white) / 1.06;
    data[i] = (white * 0.5 + last * 6) * 0.6;
  }
  noiseBuf = buf;
  return buf;
}

interface Burst {
  at?: number;
  dur: number;
  vol: number;
  type?: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  attack?: number;
}
function burst(ctx: Ctx, out: AudioNode, b: Burst): void {
  const t = ctx.currentTime + (b.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = b.type ?? 'bandpass';
  filter.Q.value = b.q ?? 0.8;
  filter.frequency.setValueAtTime(b.f0, t);
  if (b.f1) filter.frequency.exponentialRampToValueAtTime(b.f1, t + b.dur);
  const gain = ctx.createGain();
  const a = b.attack ?? 0.01;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(b.vol, t + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + b.dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + b.dur + 0.05);
  src.onended = () => gain.disconnect();
}

interface Tone {
  at?: number;
  dur: number;
  vol: number;
  type?: OscillatorType;
  f0: number;
  f1?: number;
  attack?: number;
}
function tone(ctx: Ctx, out: AudioNode, o: Tone): void {
  const t = ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(o.vol, t + (o.attack ?? 0.008));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/** Plays one effect. `v` is already scaled by the sfx volume, 0..1. */
export function playSynth(ctx: Ctx, out: AudioNode, name: SfxName, v: number): boolean {
  const n = (o: Burst) => burst(ctx, out, { ...o, vol: o.vol * v });
  const s = (o: Tone) => tone(ctx, out, { ...o, vol: o.vol * v });
  const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  switch (name) {
    case 'step_1':
    case 'step_2': {
      const base = name === 'step_1' ? 1 : 0.88;
      n({ dur: 0.11, vol: 0.5, type: 'lowpass', f0: r(700, 900) * base, f1: 220, q: 0.7 });
      n({ dur: 0.05, vol: 0.18, type: 'highpass', f0: 2600, f1: 1800 });
      s({ dur: 0.1, vol: 0.18, f0: 95 * base, f1: 48 });
      break;
    }
    case 'dig_loop':
      n({ dur: 0.16, vol: 0.5, type: 'bandpass', f0: r(1200, 2200), f1: 600, q: 1.4 });
      s({ dur: 0.09, vol: 0.1, type: 'triangle', f0: r(120, 160), f1: 70 });
      if (Math.random() < 0.35) n({ at: 0.08, dur: 0.05, vol: 0.25, type: 'highpass', f0: 4200 });
      break;
    case 'sample_get':
      [660, 880, 1320, 1760].forEach((f, i) => s({ at: i * 0.07, dur: 0.5, vol: 0.2, f0: f }));
      n({ dur: 0.5, vol: 0.12, type: 'highpass', f0: 5000, f1: 7500, q: 0.5, attack: 0.1 });
      break;
    case 'deposit':
      s({ dur: 0.25, vol: 0.35, type: 'triangle', f0: 140, f1: 60 });
      s({ at: 0.12, dur: 0.4, vol: 0.2, f0: 523 });
      s({ at: 0.22, dur: 0.5, vol: 0.2, f0: 784 });
      break;
    case 'refill_loop':
      n({ dur: 0.38, vol: 0.28, type: 'highpass', f0: 3000, f1: 4500, q: 0.4, attack: 0.08 });
      break;
    case 'refill_done':
      s({ dur: 0.18, vol: 0.2, f0: 880 });
      s({ at: 0.14, dur: 0.5, vol: 0.22, f0: 1175 });
      break;
    case 'radio_in':
      n({ dur: 0.1, vol: 0.28, type: 'bandpass', f0: 2400, q: 1.2 });
      s({ at: 0.03, dur: 0.07, vol: 0.14, type: 'square', f0: 1500 });
      s({ at: 0.11, dur: 0.07, vol: 0.12, type: 'square', f0: 1900 });
      break;
    case 'alarm_seismic':
      for (let i = 0; i < 3; i++) {
        s({ at: i * 0.32, dur: 0.14, vol: 0.18, type: 'square', f0: 620 });
        s({ at: i * 0.32 + 0.15, dur: 0.14, vol: 0.18, type: 'square', f0: 440 });
      }
      n({ dur: 1, vol: 0.2, type: 'lowpass', f0: 140, q: 0.5, attack: 0.3 });
      break;
    case 'ui_click':
      s({ dur: 0.05, vol: 0.18, f0: 1200, f1: 900 });
      break;
    case 'ui_error':
      s({ dur: 0.18, vol: 0.2, type: 'sawtooth', f0: 170, f1: 110 });
      break;
    case 'heartbeat_loop':
      s({ dur: 0.14, vol: 0.6, f0: 62, f1: 40, attack: 0.012 });
      s({ at: 0.2, dur: 0.16, vol: 0.45, f0: 54, f1: 36, attack: 0.012 });
      break;
    case 'tremor_loop':
      n({ dur: 2.6, vol: 0.7, type: 'lowpass', f0: 90, f1: 45, q: 1.2, attack: 0.5 });
      s({ dur: 2.2, vol: 0.3, f0: 38, f1: 28, attack: 0.4 });
      for (let i = 0; i < 6; i++)
        n({ at: 0.3 + i * 0.35, dur: 0.12, vol: 0.2, type: 'bandpass', f0: r(200, 500), q: 2 });
      break;
    case 'rockfall':
      n({ dur: 1.3, vol: 0.5, type: 'lowpass', f0: 600, f1: 150, q: 0.8, attack: 0.05 });
      for (let i = 0; i < 9; i++)
        n({ at: r(0, 0.9), dur: 0.08, vol: 0.4, type: 'bandpass', f0: r(300, 1400), q: 3 });
      break;
    case 'breach':
      n({ dur: 1.1, vol: 0.55, type: 'highpass', f0: 6000, f1: 1200, q: 0.5, attack: 0.03 });
      s({ dur: 0.15, vol: 0.2, type: 'square', f0: 900 });
      s({ at: 0.2, dur: 0.15, vol: 0.2, type: 'square', f0: 900 });
      break;
    case 'down':
      s({ dur: 1.2, vol: 0.3, type: 'sawtooth', f0: 320, f1: 40 });
      s({ at: 0.6, dur: 0.5, vol: 0.5, f0: 70, f1: 30 });
      n({ at: 0.6, dur: 0.5, vol: 0.3, type: 'lowpass', f0: 500, f1: 120 });
      break;
    case 'classify_ok':
      s({ dur: 0.2, vol: 0.2, f0: 660 });
      s({ at: 0.1, dur: 0.4, vol: 0.2, f0: 990 });
      break;
    case 'classify_bad':
      s({ dur: 0.25, vol: 0.2, type: 'triangle', f0: 330, f1: 220 });
      s({ at: 0.15, dur: 0.35, vol: 0.2, type: 'triangle', f0: 220, f1: 150 });
      break;
    case 'fireball':
      n({ dur: 2, vol: 0.7, type: 'bandpass', f0: 3200, f1: 260, q: 0.6, attack: 0.5 });
      s({ dur: 2, vol: 0.18, type: 'sawtooth', f0: 900, f1: 90, attack: 0.5 });
      break;
    case 'impact':
      s({ dur: 1.8, vol: 0.9, f0: 90, f1: 22, attack: 0.005 });
      n({ dur: 2.2, vol: 0.9, type: 'lowpass', f0: 900, f1: 80, q: 0.7 });
      n({ at: 0.05, dur: 0.4, vol: 0.4, type: 'bandpass', f0: 1800, f1: 300, q: 0.9 });
      break;
    case 'launch':
      n({ dur: 2.6, vol: 0.6, type: 'lowpass', f0: 150, f1: 1400, q: 0.6, attack: 1.2 });
      s({ dur: 2.4, vol: 0.2, type: 'sawtooth', f0: 60, f1: 240, attack: 1 });
      break;
    case 'stamp':
      s({ dur: 0.12, vol: 0.4, type: 'triangle', f0: 180, f1: 70 });
      n({ dur: 0.08, vol: 0.3, type: 'bandpass', f0: 1200, q: 1.5 });
      break;
    default:
      return false;
  }
  return true;
}

/** Looping Mars bed: wind, a cold drone and a tension pulse. Returns a handle. */
export interface Bed {
  setLevel(music: number, tension: number, storm: number): void;
  stop(): void;
}
export function startBed(ctx: Ctx, out: AudioNode): Bed {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(out);

  const windSrc = ctx.createBufferSource();
  windSrc.buffer = noise(ctx);
  windSrc.loop = true;
  const windF = ctx.createBiquadFilter();
  windF.type = 'bandpass';
  windF.frequency.value = 420;
  windF.Q.value = 0.7;
  const windG = ctx.createGain();
  windG.gain.value = 0.3;
  windSrc.connect(windF).connect(windG).connect(master);

  // Slow gusts: LFO on the filter and on the gain.
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.07;
  const gustF = ctx.createGain();
  gustF.gain.value = 260;
  gust.connect(gustF).connect(windF.frequency);
  const gust2 = ctx.createOscillator();
  gust2.frequency.value = 0.13;
  const gust2G = ctx.createGain();
  gust2G.gain.value = 0.25;
  gust2.connect(gust2G).connect(windG.gain);

  // Cold drone, a fifth apart, with a slow beat.
  const droneG = ctx.createGain();
  droneG.gain.value = 0.16;
  droneG.connect(master);
  const drones = [55, 58.3, 77.8, 116.5].map((f) => {
    const o = ctx.createOscillator();
    o.type = f > 100 ? 'triangle' : 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = f > 100 ? 0.25 : 0.5;
    o.connect(g).connect(droneG);
    return o;
  });
  const droneLfo = ctx.createOscillator();
  droneLfo.frequency.value = 0.05;
  const droneLfoG = ctx.createGain();
  droneLfoG.gain.value = 0.12;
  droneLfo.connect(droneLfoG).connect(droneG.gain);

  // Tension pulse: sub-bass throb that speeds up with danger.
  const pulseG = ctx.createGain();
  pulseG.gain.value = 0;
  pulseG.connect(master);
  const pulse = ctx.createOscillator();
  pulse.type = 'sine';
  pulse.frequency.value = 46;
  const pulseAm = ctx.createGain();
  pulseAm.gain.value = 0;
  pulse.connect(pulseAm).connect(pulseG);
  const pulseLfo = ctx.createOscillator();
  pulseLfo.frequency.value = 1.1;
  const pulseLfoG = ctx.createGain();
  pulseLfoG.gain.value = 0.5;
  pulseLfo.connect(pulseLfoG).connect(pulseAm.gain);
  pulseAm.gain.value = 0.5;

  // Thin high whine, like a suit sensor: barely there, grows with danger.
  const whine = ctx.createOscillator();
  whine.type = 'sine';
  whine.frequency.value = 3150;
  const whineG = ctx.createGain();
  whineG.gain.value = 0.004;
  const whineLfo = ctx.createOscillator();
  whineLfo.frequency.value = 0.21;
  const whineLfoG = ctx.createGain();
  whineLfoG.gain.value = 40;
  whineLfo.connect(whineLfoG).connect(whine.frequency);
  whine.connect(whineG).connect(master);

  // Rare distant sounds: a metallic creak or a radio chirp.
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ping = () => {
    if (!alive) return;
    const f = [185, 233, 277, 370][Math.floor(Math.random() * 4)] ?? 220;
    tone(ctx, master, { dur: 2.4, vol: 0.03, f0: f, f1: f * 0.99, attack: 0.6 });
    tone(ctx, master, { dur: 2.4, vol: 0.015, f0: f * 2.01, attack: 0.8 });
    timer = setTimeout(ping, 7000 + Math.random() * 9000);
  };
  timer = setTimeout(ping, 3500);

  const nodes = [whine, whineLfo, windSrc, gust, gust2, droneLfo, pulse, pulseLfo, ...drones];
  nodes.forEach((o) => o.start());

  return {
    setLevel(music, tension, storm) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(music * 0.45, t + 0.6);
      windG.gain.linearRampToValueAtTime(0.22 + storm * 0.7 + tension * 0.1, t + 1.2);
      windF.Q.linearRampToValueAtTime(0.7 + storm * 1.6, t + 1.2);
      droneG.gain.linearRampToValueAtTime(0.14 + tension * 0.3, t + 1.2);
      pulseG.gain.linearRampToValueAtTime(0.1 + Math.max(0, tension - 0.4) * 1.3, t + 1);
      pulseLfo.frequency.linearRampToValueAtTime(0.7 + tension * 2, t + 1);
      whineG.gain.linearRampToValueAtTime(0.004 + tension * 0.02, t + 1.5);
    },
    stop() {
      alive = false;
      if (timer) clearTimeout(timer);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(0, t + 0.4);
      setTimeout(() => {
        for (const n of nodes) {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        }
        master.disconnect();
      }, 500);
    },
  };
}
