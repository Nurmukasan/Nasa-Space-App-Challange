// =============================================================================
// SOUND MANIFEST. Every sound name the game may play. The file name equals the
// name: client/public/assets/audio/sfx/<name>.(ogg|mp3|wav) for effects,
// client/public/assets/audio/music/<name>.(ogg|mp3) for music, stings, ambience.
// `npm test` (tools/assets.test.ts) rejects unknown names, wrong folders and
// oversized files. Data only, so the validator can import it in Node.
// =============================================================================

/** Effects the game already triggers (a fallback tone plays while the file is missing). */
export const SFX_WIRED = [
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

/** v2 effects (docs/phases.md): record now, the field/console owners wire them in phases 1–3. */
export const SFX_V2 = [
  'scanner_ping',
  'discovery',
  'deploy',
  'repair_loop',
  'repair_done',
  'fault_alarm',
  'devil_loop',
  'panel_clean',
  'flare_alarm',
  'window_alarm',
  'signal_pulse',
  'act_sting',
  'radio_earth',
  'landing',
  'breath_loop',
  'objective_done',
  'ui_hover',
] as const;

export const SFX_NAMES = [...SFX_WIRED, ...SFX_V2] as const;
export type SfxName = (typeof SFX_NAMES)[number];

/** Music layers, stings and ambience. Eva layers must share tempo, key and exact length. */
export const MUSIC_NAMES = [
  'music_eva_base',
  'music_eva_tension',
  'music_eva_danger',
  'music_design',
  'sting_success',
  'sting_fail',
  'music_title',
  'amb_mars_wind',
] as const;
export type MusicName = (typeof MUSIC_NAMES)[number];
