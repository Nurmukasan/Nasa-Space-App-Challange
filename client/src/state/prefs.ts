import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
export interface Preferences {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reduceMotion: boolean;
}
const defaults: Preferences = {
  musicVolume: 0.35,
  sfxVolume: 0.7,
  muted: false,
  reduceMotion: false,
};
const KEY = 'red-signal-prefs';
function load(): Preferences {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const volume = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : fallback;
    return {
      musicVolume: volume(v.musicVolume, defaults.musicVolume),
      sfxVolume: volume(v.sfxVolume, defaults.sfxVolume),
      muted: v.muted === true,
      reduceMotion:
        typeof v.reduceMotion === 'boolean'
          ? v.reduceMotion
          : matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  } catch {
    return { ...defaults };
  }
}
export const prefs = createStore<Preferences>(() => load());
prefs.subscribe((value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* Storage may be disabled. */
  }
});
export function usePrefs<T>(selector: (value: Preferences) => T): T {
  return useStore(prefs, selector);
}
