import type { Bed } from './synth';

/** Slow, cold space pad for the menus: stacked fifths, a shimmer and an occasional far-off bell. */
export function startMenuBed(ctx: AudioContext, out: AudioNode): Bed {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(out);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 900;
  lowpass.connect(master);

  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.04;
  const sweepG = ctx.createGain();
  sweepG.gain.value = 500;
  sweep.connect(sweepG).connect(lowpass.frequency);

  // Dm9-ish pad: D2 A2 D3 F3 A3 E4, each pair slightly detuned for slow chorus.
  const notes = [73.4, 110, 146.8, 174.6, 220, 329.6];
  const oscs: OscillatorNode[] = [sweep];
  notes.forEach((f, i) => {
    for (const detune of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.05 : 0.07 / (1 + i * 0.3);
      const am = ctx.createOscillator();
      am.frequency.value = 0.03 + i * 0.011;
      const amG = ctx.createGain();
      amG.gain.value = g.gain.value * 0.8;
      am.connect(amG).connect(g.gain);
      o.connect(g).connect(lowpass);
      oscs.push(o, am);
    }
  });

  let alive = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scale = [587, 659, 784, 880, 1175, 1319];
  const bell = () => {
    if (!alive) return;
    const f = scale[Math.floor(Math.random() * scale.length)] ?? 587;
    const t = ctx.currentTime;
    for (const [mul, vol] of [
      [1, 0.05],
      [2.76, 0.02],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f * mul;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 4.1);
    }
    timer = setTimeout(bell, 3500 + Math.random() * 6000);
  };
  timer = setTimeout(bell, 2000);
  oscs.forEach((o) => o.start());

  return {
    setLevel(music) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(music * 0.6, t + 1.5);
    },
    stop() {
      alive = false;
      if (timer) clearTimeout(timer);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => {
        for (const o of oscs) {
          try {
            o.stop();
          } catch {
            /* already stopped */
          }
        }
        master.disconnect();
      }, 900);
    },
  };
}
