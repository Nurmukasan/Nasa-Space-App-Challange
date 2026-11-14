import type { StationSignal } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
function hash(value: string): number {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
/** Noise samples per second; values between samples are blended so the trace is not a square wave. */
const NOISE_HZ = 30;
function noiseAt(key: string, x: number): number {
  const i = Math.floor(x),
    f = x - i,
    w = f * f * (3 - 2 * f);
  const a = 2 * hash(`${key}:${i}`) - 1,
    b = 2 * hash(`${key}:${i + 1}`) - 1;
  return a + (b - a) * w;
}
export function signalAt(id: string, s: StationSignal, tau: number): number {
  if (tau < 0) return 0;
  const env = s.amp * Math.min(1, tau / s.riseS) * Math.exp(-Math.max(0, tau - s.riseS) / s.decayS);
  const phase = hash(`${id}:${s.stationIdx}`) * Math.PI * 2;
  return (
    env *
      Math.sin(2 * Math.PI * s.freqHz * tau + phase) *
      (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.37 * s.freqHz * tau)) +
    s.noise * noiseAt(`${id}:${s.stationIdx}`, tau * NOISE_HZ)
  );
}
export function pressureAt(signals: StationSignal[], time: number, t0: number): number {
  let value = 0;
  for (const signal of signals) {
    const tau = time - t0 - signal.delayS;
    if (tau >= 0) value -= signal.pressureDip * Math.exp(-(((tau - 1.5) / 1.2) ** 2));
  }
  return value;
}
export class Seismograph {
  private frame = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    private eventId?: string,
  ) {
    this.draw();
  }
  destroy(): void {
    cancelAnimationFrame(this.frame);
  }
  private draw = (): void => {
    this.frame = requestAnimationFrame(this.draw);
    const ctx = this.canvas.getContext('2d'),
      s = snaps.curr;
    if (!ctx || !s) return;
    const width = this.canvas.width,
      height = this.canvas.height;
    ctx.fillStyle = '#06140e';
    ctx.fillRect(0, 0, width, height);
    const rows = s.stations.length + (store.getState().room?.params?.hasWeather ? 1 : 0);
    const rowHeight = height / Math.max(1, rows);
    for (let row = 0; row < rows; row++) {
      const pressure = row === s.stations.length;
      const base = rowHeight * (row + 0.5);
      ctx.strokeStyle = '#254937';
      ctx.beginPath();
      ctx.moveTo(0, base);
      ctx.lineTo(width, base);
      ctx.stroke();
      ctx.strokeStyle = pressure ? '#77d9e5' : '#9dffb7';
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const time = s.t - 20 + (x / width) * 20;
        let value = 0;
        for (const e of s.seismic) {
          if (this.eventId && e.id !== this.eventId) continue;
          if (pressure) value += pressureAt(e.signals, time, e.t0);
          else
            for (const signal of e.signals)
              if (signal.stationIdx === row)
                value += signalAt(e.id, signal, time - e.t0 - signal.delayS);
        }
        const y = base - value * rowHeight * 0.35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };
}
