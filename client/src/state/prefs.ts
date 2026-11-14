import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
export interface Preferences {
  music: number;
  effects: number;
  muted: boolean;
  reduceMotion: boolean;
}
const defaults: Preferences = { music: 0.5, effects: 0.7, muted: false, reduceMotion: false };
function load(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem('rs.preferences') ?? '{}');
    return {
      music: volume(value.music, defaults.music),
      effects: volume(value.effects, defaults.effects),
      muted: value.muted === true,
      reduceMotion: value.reduceMotion === true,
    };
  } catch {
    return defaults;
  }
}
function volume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}
export const prefs = createStore<Preferences>(() => load());
prefs.subscribe((value) => {
  try {
    localStorage.setItem('rs.preferences', JSON.stringify(value));
  } catch {
    /* Storage may be blocked. */
  }
});
export function usePrefs(): Preferences {
  return useStore(prefs);
}
