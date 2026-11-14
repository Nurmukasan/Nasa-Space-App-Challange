import type { EvaState } from '@rs/shared';

export interface Point {
  x: number;
  y: number;
}

interface Sample {
  t: number;
  snap: EvaState;
}

/**
 * Renders remote astronauts slightly in the past so there are always two snapshots
 * around the render time. Uses the mission clock carried by each snapshot, so uneven
 * network arrival does not turn into uneven movement on screen.
 */
export class RemoteInterpolator {
  private history: Sample[] = [];
  private offset = 0;
  private hasOffset = false;

  constructor(
    private delayS: number,
    private capacity: number,
    private smoothing: number,
    private resyncS: number,
  ) {}

  /** Call once per frame with the newest snapshot and its arrival time (ms). */
  observe(snap: EvaState, arrivalMs: number): void {
    const last = this.history[this.history.length - 1];
    if (last?.snap === snap) return;
    if (last && snap.t <= last.t) this.history.length = 0;
    this.history.push({ t: snap.t, snap });
    if (this.history.length > this.capacity) this.history.shift();
    const sample = snap.t - arrivalMs / 1000;
    if (!this.hasOffset || Math.abs(sample - this.offset) > this.resyncS) {
      this.offset = sample;
      this.hasOffset = true;
    } else this.offset += (sample - this.offset) * this.smoothing;
  }

  /** Writes the interpolated position of `id` into `out`; false if it is unknown. */
  position(id: string, nowMs: number, out: Point): boolean {
    const h = this.history;
    if (h.length === 0) return false;
    const renderT = nowMs / 1000 + this.offset - this.delayS;
    let i = h.length - 1;
    while (i > 0 && h[i - 1]!.t >= renderT) i--;
    const newer = h[i]!;
    const older = i > 0 ? h[i - 1]! : null;
    const b = newer.snap.astronauts.find((a) => a.id === id);
    if (!b) return false;
    const a = older?.snap.astronauts.find((p) => p.id === id);
    if (!older || !a || renderT >= newer.t) {
      out.x = b.x;
      out.y = b.y;
      return true;
    }
    const k = Math.max(0, Math.min(1, (renderT - older.t) / Math.max(1e-6, newer.t - older.t)));
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    return true;
  }

  reset(): void {
    this.history.length = 0;
    this.hasOffset = false;
  }
}
