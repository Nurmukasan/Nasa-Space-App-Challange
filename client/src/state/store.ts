import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { EvaState, RoomState } from '@rs/shared';

export interface AppState {
  conn: 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';
  mode: 'online' | 'local' | null;
  playerId: string | null;
  room: RoomState | null;
  /** Throttled EVA snapshot for React panels (about 5 Hz). */
  hud: EvaState | null;
  error: string | null;
}

export const store = createStore<AppState>(() => ({
  conn: 'idle',
  mode: null,
  playerId: null,
  room: null,
  hud: null,
  error: null,
}));

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(store, selector);
}

export function me(s: AppState) {
  return s.room?.players.find((p) => p.id === s.playerId) ?? null;
}
