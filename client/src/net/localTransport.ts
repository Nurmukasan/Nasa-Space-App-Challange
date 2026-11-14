import { GameRoom, TICK_DT, TICK_HZ } from '@rs/shared';
import type { ClientMsg, JoinRequest, JoinResult, ServerMsg } from '@rs/shared';
import type { ConnStatus, Transport } from './transport';

/**
 * Runs the same GameRoom inside the browser. Used for solo play and as a fallback
 * when the server is unreachable. Messages are cloned so the UI can never mutate
 * engine state, exactly like over a real network.
 */
export class LocalTransport implements Transport {
  private room: GameRoom;
  private playerId = '';
  private handlers = new Set<(m: ServerMsg) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.room = new GameRoom({
      code: 'SOLO',
      seed: (Date.now() & 0x7fffffff) >>> 0,
      emit: (_target, msg) => this.deliver(msg),
      allowDebug: true,
    });
  }

  join(req: JoinRequest): Promise<JoinResult> {
    const r = this.room.join({ name: req.name });
    if (r.ok) {
      this.playerId = r.playerId;
      let last = performance.now();
      let acc = 0;
      this.timer = setInterval(
        () => {
          const now = performance.now();
          acc = Math.min(acc + (now - last) / 1000, TICK_DT * 5);
          last = now;
          while (acc >= TICK_DT) {
            this.room.tick(TICK_DT);
            acc -= TICK_DT;
          }
        },
        1000 / TICK_HZ / 2,
      );
    }
    return Promise.resolve(structuredClone(r));
  }

  send(msg: ClientMsg): void {
    const copy = structuredClone(msg);
    queueMicrotask(() => this.room.handle(this.playerId, copy));
  }

  onMessage(cb: (msg: ServerMsg) => void): () => void {
    this.handlers.add(cb);
    return () => this.handlers.delete(cb);
  }

  onStatus(_cb: (status: ConnStatus) => void): () => void {
    return () => undefined;
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private deliver(msg: ServerMsg): void {
    const copy = structuredClone(msg);
    for (const h of this.handlers) h(copy);
  }
}
