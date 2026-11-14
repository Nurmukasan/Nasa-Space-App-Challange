import type { Astronaut, EvaState } from '@rs/shared';
export interface Contact {
  crew: Astronaut;
  seenAt: number;
}
/** Cache only linked telemetry; disconnected coordinates and oxygen must stay private. */
export class Telemetry {
  readonly contacts = new Map<string, Contact>();
  private tick = -1;
  private time = -Infinity;
  observe(snap: EvaState): void {
    if (snap.tick === this.tick && snap.t === this.time) return;
    if (snap.t < this.time) this.contacts.clear();
    this.tick = snap.tick;
    this.time = snap.t;
    for (const crew of snap.astronauts)
      if (crew.linked) this.contacts.set(crew.id, { crew: structuredClone(crew), seenAt: snap.t });
  }
}
