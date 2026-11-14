import { fxBus, audio } from './clientServices';
import { diagnostics } from '../state/diagnostics';
import type { ClientMsg } from '@rs/shared';
import { clearSnaps, pushSnap } from '../state/snapshots';
import { store } from '../state/store';
import { LocalTransport } from './localTransport';
import { SocketTransport } from './socketTransport';
import type { Transport } from './transport';

let transport: Transport | null = null;
let snapCount = 0;
let generation = 0;
const HUD_EVERY = 3; // 15 Hz snapshots -> 5 Hz React updates

export async function startSession(
  mode: 'online' | 'local',
  name: string,
  code?: string,
  token?: string,
): Promise<void> {
  endSession();
  const current = generation;
  snapCount = 0;
  store.setState({ conn: 'connecting', mode, error: null });
  const t: Transport = mode === 'local' ? new LocalTransport() : new SocketTransport();
  transport = t;
  t.onMessage((m) => {
    if (generation !== current) return;
    if (m.t === 'state') {
      const phaseChanged = store.getState().room?.phase !== m.state.phase;
      if (phaseChanged && m.state.phase !== 'eva') {
        clearSnaps();
        store.setState({ room: m.state, hud: null });
      } else {
        store.setState({ room: m.state });
      }
    } else if (m.t === 'snap') {
      pushSnap(m.snap);
      fxBus?.consume(m.snap);
      diagnostics.snapshotBytes = new TextEncoder().encode(JSON.stringify(m.snap)).byteLength;
      if (snapCount++ % HUD_EVERY === 0) store.setState({ hud: m.snap });
    } else {
      store.setState({ error: m.code });
    }
  });
  t.onStatus((s) => {
    if (current === generation) store.setState({ conn: s });
  });
  const r = await t.join({ name, code, token });
  if (current !== generation) {
    t.close();
    return;
  }
  if (!r.ok) {
    t.close();
    transport = null;
    forgetSession();
    store.setState({ conn: 'idle', mode: null, error: r.error });
    return;
  }
  if (mode === 'online') {
    try {
      sessionStorage.setItem('rs.session', JSON.stringify({ code: r.code, name, token: r.token }));
    } catch {
      /* Storage may be blocked. */
    }
  }
  store.setState({ conn: 'online', playerId: r.playerId, room: r.state });
}

export function send(msg: ClientMsg): void {
  if (msg.t.startsWith('mc:')) audio?.sfx('ui_click');
  transport?.send(msg);
}

export function endSession(): void {
  generation++;
  forgetSession();
  transport?.close();
  transport = null;
  clearSnaps();
  store.setState({ conn: 'idle', mode: null, playerId: null, room: null, hud: null });
}

function forgetSession(): void {
  try {
    sessionStorage.removeItem('rs.session');
  } catch {
    /* Storage may be blocked. */
  }
}
export function restoreSession(): void {
  try {
    const value = JSON.parse(sessionStorage.getItem('rs.session') ?? 'null');
    if (
      value &&
      typeof value.code === 'string' &&
      /^[A-Z]{4}$/.test(value.code) &&
      typeof value.name === 'string' &&
      typeof value.token === 'string' &&
      value.token.length > 0
    )
      void startSession('online', value.name, value.code, value.token);
  } catch {
    forgetSession();
  }
}
