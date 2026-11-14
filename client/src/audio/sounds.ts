export const SFX_NAMES = [
  'step_1',
  'step_2',
  'dig_loop',
  'sample_get',
  'deposit',
  'refill_loop',
  'refill_done',
  'radio_in',
  'alarm_seismic',
  'ui_click',
  'ui_error',
  'heartbeat_loop',
  'tremor_loop',
  'rockfall',
  'breach',
  'down',
  'classify_ok',
  'classify_bad',
  'fireball',
  'impact',
  'launch',
  'stamp',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];
export type MusicName =
  | 'music_eva_base'
  | 'music_eva_tension'
  | 'music_eva_danger'
  | 'music_design'
  | 'sting_success'
  | 'sting_fail';
export const soundFiles = import.meta.glob('/public/assets/audio/**/*.{wav,ogg,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
});
export function sources(name: string): string[] {
  return Object.keys(soundFiles)
    .filter(
      (path) =>
        path
          .split('/')
          .at(-1)
          ?.replace(/\.[^.]+$/, '') === name,
    )
    .sort((a, b) => (a.endsWith('.ogg') ? -1 : b.endsWith('.ogg') ? 1 : a.localeCompare(b)))
    .map((path) => `${import.meta.env.BASE_URL}${path.replace('/public/', '')}`);
}
