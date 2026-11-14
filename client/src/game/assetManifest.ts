// =============================================================================
// IMAGE MANIFEST. The single list of every picture the game may load.
// Artists: docs/assets.md explains every row. `npm test` (tools/assets.test.ts)
// fails if a file in client/public/assets/sprites/ has a name or size that does
// not match this list, so a wrong file never reaches the game.
// Data only: no Phaser, no DOM, no import.meta (the validator runs in Node).
// =============================================================================
import { CREW_CLASS_IDS, MODULE_ORDER, RELAYS, VEHICLES } from '@rs/shared';

/** field = Phaser field view (loaded as a spritesheet); ui = React screens (design, report, lobby). */
export type AssetUse = 'field' | 'ui';

export interface AssetSpec {
  /** File name without extension: client/public/assets/sprites/<key>.png */
  key: string;
  /** Size of ONE frame in pixels. */
  width: number;
  height: number;
  /** Frames in one horizontal row: the file is (width × frames) × height pixels. */
  frames: number;
  use: AssetUse;
  /** false = planned for v2: the validator accepts the file; the owner wires it in a later phase. */
  wired: boolean;
}

const sheet = (
  key: string,
  width: number,
  height: number,
  frames: number,
  wired: boolean,
): AssetSpec => ({ key, width, height, frames, use: 'field', wired });
const ui = (key: string, width: number, height: number, wired = false): AssetSpec => ({
  key,
  width,
  height,
  frames: 1,
  use: 'ui',
  wired,
});

/** Award and objective codes are listed in docs/product-logic.md (sections 7.18 and 8.4). */
const AWARDS = [
  'rock_hound',
  'pathfinder',
  'explorer',
  'lifeguard',
  'mechanic',
  'iron_lungs',
  'seismologist',
  'flight_director',
];
const OBJECTIVES = [
  'deliver',
  'deliver_deep',
  'deploy_stations',
  'locate_signal',
  'retrieve_signal',
  'discover',
  'repair_all',
  'all_aboard',
  'classify',
];

export const ASSETS: AssetSpec[] = [
  // --- Wired: the field view already draws these (procedural fallback until the file exists).
  sheet('astronaut', 16, 16, 9, true),
  sheet('astronaut_stripe', 16, 16, 9, true),
  // Crew classes: same 9-frame layout at 64x64, drawn at half size in the field. AI-generated.
  ...CREW_CLASS_IDS.map((id) => sheet(`crew_${id}`, 64, 64, 9, true)),
  sheet('lander', 128, 96, 1, true),
  ...['delta', 'crater', 'basalt', 'impact'].map((kind) => sheet(`site_${kind}`, 16, 16, 2, true)),
  sheet('samples', 8, 8, 3, true),
  sheet('station', 16, 16, 1, true),
  sheet('beacon', 16, 24, 6, true),
  ...[1, 2, 3].map((n) => sheet(`rock_${n}`, 16, 16, 1, true)),
  ...['dust', 'spark'].map((kind) => sheet(`fx_${kind}`, 8, 8, 4, true)),
  ...[
    ...MODULE_ORDER.map((id) => `icon_${id}`),
    ...Object.keys(VEHICLES).map((id) => `icon_vehicle_${id}`),
    ...Object.keys(RELAYS).map((id) => `icon_relay_${id}`),
  ].map((key) => sheet(key, 32, 32, 1, true)),

  // --- v2 field sprites (docs/phases.md): draw now, wired during phases 1–3.
  sheet('site_signal', 16, 16, 2, true),
  sheet('port', 8, 8, 2, true),
  sheet('station_kit', 16, 16, 1, true),
  sheet('devil', 32, 32, 6, true),
  sheet('boulder_1', 32, 32, 1, true),
  sheet('boulder_2', 32, 32, 1, true),
  sheet('debris_chute', 32, 32, 1, true),
  sheet('crater_decal', 32, 32, 1, true),
  sheet('lander_flame', 32, 32, 4, true),
  sheet('fx_ice', 8, 8, 4, false),
  sheet('fx_debris', 8, 8, 4, true),
  sheet('drone', 16, 16, 4, false),
  sheet('drone_shadow', 16, 8, 1, false),
  sheet('icon_scout_drone', 32, 32, 1, false),

  // --- v2 interface images (React screens): one frame each.
  ui('title_bg', 480, 270, true),
  ui('lander_cutaway', 240, 160, true),
  ...Object.keys(VEHICLES).map((id) => ui(`rocket_${id}`, 48, 128, true)),
  ui('stamp_success', 160, 64),
  ui('stamp_failed', 160, 64),
  ...AWARDS.map((code) => ui(`award_${code}`, 32, 32, true)),
  ...OBJECTIVES.map((kind) => ui(`obj_${kind}`, 16, 16)),
  ...['earth', 'tulpar', 'mc'].map((who) => ui(`portrait_${who}`, 32, 32)),
];

/** Upper bounds that keep the first load small (docs/architecture.md, section 10.1). */
export const ASSET_LIMITS = {
  spriteBytes: 256 * 1024,
  sfxBytes: 400 * 1024,
  musicBytes: 3 * 1024 * 1024,
};
