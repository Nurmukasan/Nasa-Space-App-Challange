import { diagnostics } from '../state/diagnostics';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { EV_JOIN, EV_MSG } from '@rs/shared';
import type { ClientMsg, JoinRequest, JoinResult, ServerMsg } from '@rs/shared';
import type { ConnStatus, Transport } from './transport';

const JOIN_TIMEOUT_MS = 8000;

export class SocketTransport implements Transport {
  private socket: Socket;
  private msgHandlers = new Set<(m: ServerMsg) => void>();
  private statusHandlers = new Set<(s: ConnStatus) => void>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private rejoin: JoinRequest | null = null;

  constructor(url?: string) {
    this.socket = url ? io(url, { autoConnect: false }) : io({ autoConnect: false });
    this.socket.on(EV_MSG, (m: ServerMsg) => {
      for (const h of this.msgHandlers) h(m);
    });
    this.socket.on('disconnect', () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      diagnostics.pingMs = null;
      this.status('reconnecting');
    });
    this.socket.on('connect', () => {
      this.heartbeat = setInterval(() => {
        const start = performance.now();
        this.socket.timeout(2000).emit('latency', (error: Error | null) => {
          diagnostics.pingMs = error ? null : performance.now() - start;
        });
      }, 2000);
      // After a dropped connection, take our slot back using the token.
      if (this.rejoin)
        this.socket.emit(EV_JOIN, this.rejoin, (r: JoinResult) => {
          if (r.ok) {
            for (const h of this.msgHandlers) h({ t: 'state', state: r.state });
            this.status('online');
          } else {
            this.status('offline');
          }
        });
    });
  }

  join(req: JoinRequest): Promise<JoinResult> {
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, error: 'room_not_found' }),
        JOIN_TIMEOUT_MS,
      );
      const go = (): void => {
        this.socket.emit(EV_JOIN, req, (r: JoinResult) => {
          clearTimeout(timer);
          if (r.ok) {
            this.rejoin = { name: req.name, code: r.code, token: r.token };
            this.status('online');
          }
          resolve(r);
        });
      };
      if (this.socket.connected) go();
      else {
        this.socket.once('connect', go);
        this.socket.connect();
      }
    });
  }

  send(msg: ClientMsg): void {
    this.socket.emit(EV_MSG, msg);
  }

  onMessage(cb: (msg: ServerMsg) => void): () => void {
    this.msgHandlers.add(cb);
    return () => this.msgHandlers.delete(cb);
  }

  onStatus(cb: (status: ConnStatus) => void): () => void {
    this.statusHandlers.add(cb);
    return () => this.statusHandlers.delete(cb);
  }

  close(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.rejoin = null;
    this.socket.close();
  }

  private status(s: ConnStatus): void {
    for (const h of this.statusHandlers) h(s);
  }
}
