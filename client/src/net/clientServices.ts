import type { EvaState } from '@rs/shared';
interface Audio {
  unlock(): void;
  sfx(name: string): void;
  setVolume?(kind: string, value: number): void;
  mute?(value: boolean): void;
}
interface Services {
  audio?: Audio;
  fxBus?: { consume(snap: EvaState): void };
}
// B owns these modules. Glob discovery keeps C usable until B0 lands.
const modules = import.meta.glob<Services>(['../audio/index.ts', '../fx/FxBus.ts'], {
  eager: true,
});
export const audio = Object.values(modules).find((m) => m.audio)?.audio;
export const fxBus = Object.values(modules).find((m) => m.fxBus)?.fxBus;
