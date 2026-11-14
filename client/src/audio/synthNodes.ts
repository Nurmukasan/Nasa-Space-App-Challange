type Ctx = AudioContext;

let noiseBuf: AudioBuffer | null = null;
export function noise(ctx: Ctx): AudioBuffer {
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

export interface Burst {
  at?: number;
  dur: number;
  vol: number;
  type?: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  attack?: number;
}
export function burst(ctx: Ctx, out: AudioNode, b: Burst): void {
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

export interface Tone {
  at?: number;
  dur: number;
  vol: number;
  type?: OscillatorType;
  f0: number;
  f1?: number;
  attack?: number;
}
export function tone(ctx: Ctx, out: AudioNode, o: Tone): void {
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
