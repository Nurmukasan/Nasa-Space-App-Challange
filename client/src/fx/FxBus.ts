import type { EvaState, FxEvent, FxType } from '@rs/shared';

type Handler = (event: FxEvent) => void;

export class FxBus {
  private handlers = new Map<FxType, Set<Handler>>();
  private lastId = 0;
  private tick = -1;

  on(type: FxType, handler: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler);
    return () => set.delete(handler);
  }

  consume(snap: EvaState): void {
    if (snap.tick < this.tick) this.lastId = 0;
    this.tick = snap.tick;
    for (const event of snap.fx) {
      if (event.id <= this.lastId) continue;
      this.lastId = event.id;
      for (const handler of this.handlers.get(event.type) ?? []) handler(event);
    }
  }

  reset(): void {
    this.lastId = 0;
    this.tick = -1;
  }
}

export const fxBus = new FxBus();
