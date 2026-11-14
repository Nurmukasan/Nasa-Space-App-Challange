import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
export interface Preferences {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reduceMotion: boolean;
  /** Dust, glare and tint painted on the helmet glass. Off keeps the view clean. */
  visorGlass: boolean;
  /** Astronaut suit id, see game/skins.ts. Only your own astronaut uses it. */
  skin: string;
}
const defaults: Preferences = {
  musicVolume: 0.35,
  sfxVolume: 0.7,
  muted: false,
  reduceMotion: false,
  visorGlass: false,
  skin: 'classic',
};
const KEY = 'red-signal-prefs';
function load(): Preferences {
  let reduceMotion = defaults.reduceMotion;
  try {
    reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* Non-browser context. */
  }
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const v = parsed !== null && typeof parsed === 'object' ? (parsed as Partial<Preferences>) : {};
    const volume = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : fallback;
    return {
      musicVolume: volume(v.musicVolume, defaults.musicVolume),
      sfxVolume: volume(v.sfxVolume, defaults.sfxVolume),
      muted: v.muted === true,
      reduceMotion: typeof v.reduceMotion === 'boolean' ? v.reduceMotion : reduceMotion,
      visorGlass: v.visorGlass === true,
      skin: typeof v.skin === 'string' ? v.skin : defaults.skin,
    };
  } catch {
    return { ...defaults, reduceMotion };
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
