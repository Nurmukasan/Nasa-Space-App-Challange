import type { ClientMsg, JoinRequest, JoinResult, ServerMsg } from '@rs/shared';

export type ConnStatus = 'online' | 'reconnecting' | 'offline';

/** The only door between UI and game engine. Two implementations: socket and local. */
export interface Transport {
  join(req: JoinRequest): Promise<JoinResult>;
  send(msg: ClientMsg): void;
  onMessage(cb: (msg: ServerMsg) => void): () => void;
  onStatus(cb: (status: ConnStatus) => void): () => void;
  close(): void;
}
