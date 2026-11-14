import { send, startSession } from '../../net/session';
import { store } from '../../state/store';

/** First click opens a ready solo lobby; the second Quick start click launches training. */
export async function startSoloLobby(name: string): Promise<void> {
  await startSession('local', name);
  const state = store.getState();
  if (state.mode !== 'local' || !state.room || !state.playerId || state.room.phase !== 'lobby')
    return;
  send({ t: 'lobby:role', role: 'solo' });
  send({ t: 'lobby:scenario', id: 'training' });
}
