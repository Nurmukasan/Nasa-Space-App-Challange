export { MUSIC_NAMES, SFX_NAMES } from './soundManifest';
export type { MusicName, SfxName } from './soundManifest';
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
