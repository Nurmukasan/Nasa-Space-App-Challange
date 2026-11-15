// Crew class sprites, drawn in code. Pure: returns RGBA pixels, no DOM, so it is testable in Node.
// Look follows the team's reference sheets; every pixel here is our own.
// Frame layout matches the base astronaut: 0-1 idle (front), 2-5 walk (side, facing right),
// 6-7 work (side), 8 down, 9 sit (front), 10 asleep on the back (front, head to the left).
// Inside the base every class shares the same actions: 11-12 work at a console (back view),
// 13-14 tend plants with a watering can (side), 15-16 talk to the AI (back view, waving),
// 17 seated in profile (side chairs).
// The game mirrors the side frames when walking left.
import type { CrewClassId } from '@rs/shared';

import { CREW_FEET_Y, CREW_FRAME, Frame, front, helmet, side } from './crewBody';
import type { Palette, Pose } from './crewBody';

export { CREW_FEET_Y, CREW_FRAME };
export const CREW_FRAMES = 18;
/** Frames used inside the base (each animated one is two frames long). */
export const CREW_SIT = 9;
export const CREW_SLEEP = 10;
export const CREW_CONSOLE = 11;
export const CREW_TEND = 13;
export const CREW_TALK = 15;
export const CREW_SIT_SIDE = 17;

const CAN = 0x6e9fc6;
const CAN_SHADE = 0x44708f;
const WATER = 0x9fd8ff;

const PALETTES: Record<CrewClassId, Palette> = {
  engineer: {
    helmet: 0x2c4a56,
    helmetShade: 0x1d313a,
    suit: 0x2c4a56,
    suitShade: 0x1d313a,
    accent: 0x2fd6d0,
    glow: 0x9af7f0,
    pack: 0x1d313a,
    packShade: 0x132229,
    boot: 0x132229,
    tool: 0x8a96a0,
  },
  scout: {
    helmet: 0xb0262c,
    helmetShade: 0x721418,
    suit: 0x2e2e34,
    suitShade: 0x1d1d22,
    accent: 0xf2c230,
    glow: 0xffe68a,
    pack: 0x3c3c44,
    packShade: 0x26262c,
    boot: 0x1d1d22,
    tool: 0xf2c230,
  },
  geologist: {
    helmet: 0x45454c,
    helmetShade: 0x2c2c32,
    suit: 0xc8702a,
    suitShade: 0x8e4c1c,
    accent: 0xeaa548,
    glow: 0xf6d6a6,
    pack: 0x4c4c54,
    packShade: 0x34343a,
    boot: 0x2c2c32,
    tool: 0x9aa0a8,
  },
  biologist: {
    helmet: 0xe8e2cf,
    helmetShade: 0xb6af9b,
    suit: 0xe8e2cf,
    suitShade: 0xb6af9b,
    accent: 0x4e9e3c,
    glow: 0xa6e070,
    pack: 0x3e4e3a,
    packShade: 0x2a3628,
    boot: 0x3a3a3e,
    tool: 0x7cd05a,
  },
};

/** Work pose: crouched forward with the class tool; `beat` alternates the tool between frames. */
function work(f: Frame, p: Palette, id: CrewClassId, beat: number): void {
  side(f, p, id, { near: 3, far: -2, nearLift: 0, farLift: 0, bob: 1, arm: 0 });
  const hy = 15;
  f.rect(14, hy - 1, 4, 2, p.suitShade); // arm reaching forward
  f.rect(18, hy - 1, 1, 2, p.boot);
  if (id === 'geologist') {
    // Pickaxe: raised, then striking the ground.
    if (beat === 0) {
      f.rect(18, hy - 6, 1, 6, 0x6a4a2a);
      f.rect(16, hy - 7, 5, 1, p.tool);
      f.set(16, hy - 6, p.tool);
    } else {
      f.rect(19, hy, 1, 5, 0x6a4a2a);
      f.rect(18, hy + 5, 4, 1, p.tool);
      f.set(22, hy + 6, p.accent);
      f.set(17, hy + 6, p.accent);
    }
  } else if (id === 'engineer') {
    // Wrench turning a bolt, sparks on the second beat.
    f.rect(19, hy - 1, 3, 1, p.tool);
    f.rect(beat === 0 ? 21 : 20, beat === 0 ? hy - 3 : hy, 2, 2, p.tool);
    if (beat === 1) {
      f.set(22, hy + 3, p.glow);
      f.set(20, hy + 4, p.accent);
    }
  } else {
    // Scout and biologist: hand scanner with a beam to the ground.
    f.rect(19, hy - 2, 3, 3, id === 'scout' ? p.packShade : p.pack);
    f.set(20, hy - 1, p.tool);
    for (let i = 1; i <= 5; i++) if ((i + beat) % 2 === 0) f.set(20 + i * 0.4, hy + 1 + i, p.glow);
  }
}

function down(f: Frame, p: Palette, id: CrewClassId): void {
  // Lying on the back: the standing side pose turned 90 degrees, head to the right.
  const stand = new Frame();
  side(stand, p, id, { near: 0, far: 0, nearLift: 0, farLift: 0, bob: 0, arm: 0 });
  for (let y = 0; y < CREW_FRAME; y++)
    for (let x = 0; x < CREW_FRAME; x++) {
      const c = stand.get(x, y);
      if (c !== -1) f.set(CREW_FRAME - 1 - y, x + 2, c);
    }
}

/** Seated, facing the viewer: thighs come towards us, boots rest just below the seat. */
function sit(f: Frame, p: Palette, id: CrewClassId): void {
  const top = 13;
  f.rect(5, top - 2, 14, 6, p.packShade);
  // Thighs seen end-on, knees, shins and boots in front of the seat.
  f.rect(7, top + 5, 4, 2, p.suit);
  f.rect(13, top + 5, 4, 2, p.suit);
  f.rect(8, top + 7, 3, 2, p.suitShade);
  f.rect(13, top + 7, 3, 2, p.suitShade);
  f.rect(8, top + 9, 3, 1, p.boot);
  f.rect(13, top + 9, 3, 1, p.boot);
  f.set(9, top + 5, p.accent);
  f.set(14, top + 5, p.accent);
  // Torso, belt and chest panel.
  f.rect(7, top, 10, 5, p.suit);
  f.rect(15, top, 2, 5, p.suitShade);
  f.rect(7, top + 4, 10, 1, p.suitShade);
  f.rect(10, top + 1, 4, 2, id === 'biologist' ? p.accent : p.suitShade);
  f.set(11, top + 1, p.glow);
  // Arms resting on the knees.
  f.rect(5, top + 1, 2, 4, p.suitShade);
  f.rect(17, top + 1, 2, 4, p.suitShade);
  f.rect(6, top + 5, 2, 1, p.boot);
  f.rect(16, top + 5, 2, 1, p.boot);
  f.rect(8, top - 1, 8, 1, p.packShade);
  helmet(f, p, id, 12, 8, false);
}

/** Asleep on the back: the front pose laid down, visor up, head to the left. */
function sleep(f: Frame, p: Palette, id: CrewClassId): void {
  const stand = new Frame();
  front(stand, p, id, 0);
  for (let y = 0; y < CREW_FRAME; y++)
    for (let x = 0; x < CREW_FRAME; x++) {
      const c = stand.get(x, y);
      if (c !== -1) f.set(y, CREW_FRAME - 1 - x + 2, c);
    }
}

/** Back of the helmet: no visor, a dark seam and the antenna in the middle. */
function helmetBack(f: Frame, p: Palette, id: CrewClassId, cy: number): void {
  f.rect(12, cy - 7, 1, 3, p.packShade);
  f.set(12, cy - 8, p.glow);
  f.ellipse(12, cy, 5.6, 5.3, p.helmet, p.helmetShade);
  f.rect(8, cy + 3, 9, 1, p.helmetShade);
  if (id === 'scout' || id === 'geologist') f.rect(8, cy + 4, 9, 1, p.accent);
  if (id === 'biologist') f.set(12, cy - 6, p.accent);
}

/**
 * Seen from behind, facing a console or the AI screen. `left`/`right` lift each elbow (px) as the
 * hands work the keys in front; `wave` (0, 1 or 2) raises the right arm and swings the glove.
 */
function back(f: Frame, p: Palette, id: CrewClassId, left: number, right: number, wave = 0): void {
  const top = 12;
  f.rect(8, 17, 3, 4, p.suitShade);
  f.rect(13, 17, 3, 4, p.suitShade);
  f.rect(8, 21, 3, 2, p.boot);
  f.rect(13, 21, 3, 2, p.boot);
  f.rect(7, top, 10, 6, p.suit);
  f.rect(7, top, 2, 6, p.suitShade);
  // Backpack fills the back, with the class light.
  f.rect(8, top - 1, 8, 6, p.pack);
  f.rect(8, top + 4, 8, 1, p.packShade);
  f.set(10, top + 1, p.glow);
  f.set(13, top + 1, p.accent);
  if (id === 'biologist') f.rect(14, top, 1, 3, p.glow);
  helmetBack(f, p, id, 7);
  // Arms last, outside the body, with a class-coloured cuff so they read against the suit.
  const arm = (x: number, lift: number, out: number): void => {
    f.rect(x + out, top + 1 - lift, 2, 4, p.suit);
    f.rect(x + out, top + 3 - lift, 2, 1, p.accent);
  };
  arm(5, left, -Math.sign(left));
  if (!wave) return arm(17, right, Math.sign(right));
  // Waving: upper arm out, forearm up beside the helmet, glove swinging between frames.
  const gx = 19 + wave;
  f.rect(18, top - 1, 2, 3, p.suit);
  f.rect(gx, top - 5, 2, 4, p.suit);
  f.rect(gx, top - 3, 2, 1, p.accent);
  f.rect(gx, top - 7, 2, 2, p.glow);
}

/** Seated in profile facing right: thighs level on the seat, shins down, hands on the knees. */
function sitSide(f: Frame, p: Palette, id: CrewClassId): void {
  const hipY = 16;
  f.rect(5, hipY - 8, 4, 7, p.pack);
  f.rect(5, hipY - 2, 4, 1, p.packShade);
  if (id === 'biologist') f.rect(6, hipY - 7, 2, 4, p.glow);
  f.rect(9, hipY - 5, 7, 6, p.suit);
  f.rect(9, hipY - 5, 2, 6, p.suitShade);
  f.set(14, hipY - 3, p.glow);
  f.rect(10, hipY, 8, 3, p.suit); // thigh along the seat
  f.set(16, hipY, p.accent);
  f.rect(16, hipY + 3, 3, 3, p.suitShade); // shin
  f.rect(16, hipY + 5, 5, 2, p.boot);
  f.rect(13, hipY - 4, 2, 4, p.suitShade); // arm down to the knee
  f.rect(15, hipY - 1, 2, 1, p.boot);
  helmet(f, p, id, 12, 8, true);
}

/** Watering a planter: side view, bent forward, can tipped; `beat` moves the water drops. */
function tend(f: Frame, p: Palette, id: CrewClassId, beat: number): void {
  side(f, p, id, { near: 2, far: -1, nearLift: 0, farLift: 0, bob: 1, arm: 1 });
  const hy = 14;
  f.rect(14, hy, 3, 2, p.suitShade); // arm forward
  f.rect(17, hy, 4, 3, CAN);
  f.rect(17, hy + 2, 4, 1, CAN_SHADE);
  f.rect(16, hy - 1, 2, 1, CAN_SHADE); // handle
  f.set(21, hy, CAN_SHADE); // spout
  f.set(22, hy + 1, CAN_SHADE);
  for (let i = 0; i < 3; i++) f.set(22 + (i % 2), hy + 3 + i * 2 + beat, WATER);
}

const WALK: Pose[] = [
  { near: 3, far: -3, nearLift: 0, farLift: 0, bob: 0, arm: -2 }, // contact
  { near: 0, far: 1, nearLift: 0, farLift: 2, bob: -1, arm: 0 }, // passing, far foot up
  { near: -3, far: 3, nearLift: 0, farLift: 0, bob: 0, arm: 2 }, // contact, other foot
  { near: 1, far: 0, nearLift: 2, farLift: 0, bob: -1, arm: 0 }, // passing, near foot up
];

/** All frames of one class as an RGBA strip (CREW_FRAMES * 24) x 24. */
export function crewSheet(id: CrewClassId): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const p = PALETTES[id];
  const frames: Frame[] = [];
  for (let i = 0; i < CREW_FRAMES; i++) frames.push(new Frame());
  front(frames[0]!, p, id, 0);
  front(frames[1]!, p, id, 1);
  WALK.forEach((pose, i) => side(frames[2 + i]!, p, id, pose));
  work(frames[6]!, p, id, 0);
  work(frames[7]!, p, id, 1);
  down(frames[8]!, p, id);
  sit(frames[CREW_SIT]!, p, id);
  sleep(frames[CREW_SLEEP]!, p, id);
  back(frames[CREW_CONSOLE]!, p, id, 3, 0);
  back(frames[CREW_CONSOLE + 1]!, p, id, 0, 3);
  tend(frames[CREW_TEND]!, p, id, 0);
  tend(frames[CREW_TEND + 1]!, p, id, 1);
  back(frames[CREW_TALK]!, p, id, 0, 0, 1);
  back(frames[CREW_TALK + 1]!, p, id, 0, 0, 2);
  sitSide(frames[CREW_SIT_SIDE]!, p, id);
  const width = CREW_FRAME * CREW_FRAMES,
    height = CREW_FRAME;
  const data = new Uint8ClampedArray(width * height * 4);
  frames.forEach((f, i) => {
    f.outline();
    for (let y = 0; y < CREW_FRAME; y++)
      for (let x = 0; x < CREW_FRAME; x++) {
        const c = f.get(x, y);
        if (c === -1) continue;
        const o = (y * width + i * CREW_FRAME + x) * 4;
        data[o] = (c >> 16) & 255;
        data[o + 1] = (c >> 8) & 255;
        data[o + 2] = c & 255;
        data[o + 3] = 255;
      }
  });
  return { width, height, data };
}
