import type { MusicName, SfxName } from './sounds';
export type { SfxName } from './sounds';
export interface SfxOptions {
  volume?: number;
  x?: number;
  y?: number;
}
export const audio = {
  unlock(): void {},
  sfx(_name: SfxName, _opts?: SfxOptions): void {},
  loop(_name: SfxName | MusicName): void {},
  stop(_name: SfxName | MusicName): void {},
  setTension(_value: number): void {},
  setVolume(_kind: 'music' | 'sfx', _value: number): void {},
  mute(_value: boolean): void {},
};
