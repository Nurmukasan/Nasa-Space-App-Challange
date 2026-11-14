// Crew class sprites, drawn in code. Pure: returns RGBA pixels, no DOM, so it is testable in Node.
// Look follows the team's reference sheets; every pixel here is our own.
// Frame layout matches the base astronaut: 0-1 idle (front), 2-5 walk (side, facing right),
// 6-7 work (side), 8 down. The game mirrors the side frames when walking left.
import type { CrewClassId } from '@rs/shared';

export const CREW_FRAME = 24;
export const CREW_FRAMES = 9;
/** Boots stand on this row of the frame. */
export const CREW_FEET_Y = 22;

interface Palette {
  helmet: number;
  helmetShade: number;
  suit: number;
  suitShade: number;
  accent: number;
  glow: number;
  pack: number;
  packShade: number;
  boot: number;
  tool: number;
}

const OUTLINE = 0x12141c;
const VISOR = 0xefe6cf;
const VISOR_SHADE = 0xc4b99e;
const VISOR_HI = 0xffffff;

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

/** One 24x24 frame as packed 0xRRGGBB, -1 = transparent. */
class Frame {
  px = new Int32Array(CREW_FRAME * CREW_FRAME).fill(-1);
  set(x: number, y: number, c: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < CREW_FRAME && y < CREW_FRAME) this.px[y * CREW_FRAME + x] = c;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= CREW_FRAME || y >= CREW_FRAME) return -1;
    return this.px[y * CREW_FRAME + x]!;
  }
  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Filled ellipse; `shade` colours the lower-right part for a simple light from the top-left. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number, shade = c): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx,
          dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        this.set(x, y, dx * 0.6 + dy > 0.55 ? shade : c);
      }
  }
  /** 1-px dark outline around the whole silhouette. */
  outline(): void {
    const copy = this.px.slice();
    for (let y = 0; y < CREW_FRAME; y++)
      for (let x = 0; x < CREW_FRAME; x++) {
        if (copy[y * CREW_FRAME + x] !== -1) continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const nx = x + dx!,
            ny = y + dy!;
          return (
            nx >= 0 &&
            ny >= 0 &&
            nx < CREW_FRAME &&
            ny < CREW_FRAME &&
            copy[ny * CREW_FRAME + nx] !== -1
          );
        });
        if (near) this.px[y * CREW_FRAME + x] = OUTLINE;
      }
  }
}

function helmet(
  f: Frame,
  p: Palette,
  id: CrewClassId,
  cx: number,
  cy: number,
  side: boolean,
): void {
  // Antenna on the back of the helmet, tipped with the class glow.
  const ax = side ? cx - 5 : cx - 4;
  f.rect(ax, cy - 6, 1, 3, p.packShade);
  f.set(ax, cy - 7, p.glow);
  f.ellipse(cx, cy, 5.6, 5.3, p.helmet, p.helmetShade);
  if (id === 'scout') f.rect(cx - 4, cy + 4, 9, 1, p.accent); // yellow collar band
  if (id === 'geologist') f.rect(cx - 4, cy + 4, 9, 1, p.accent);
  if (id === 'biologist') {
    f.set(cx, cy - 6, p.accent); // sprout on top of the helmet
    f.set(cx - 1, cy - 7, p.glow);
    f.set(cx + 1, cy - 7, p.accent);
  }
  // Big glass visor with a dark rim: the face of the character.
  const vx = side ? cx + 2.2 : cx,
    vy = cy + 0.4,
    rx = side ? 3 : 4.1,
    ry = 3.5;
  f.ellipse(vx, vy, rx + 0.9, ry + 0.8, OUTLINE);
  f.ellipse(vx, vy, rx, ry, VISOR, VISOR_SHADE);
  f.rect(vx - (side ? 1 : 2), vy - 2, 1, 2, VISOR_HI);
  f.set(vx - (side ? 0 : 1), vy - 2.5, VISOR_HI);
}

function front(f: Frame, p: Palette, id: CrewClassId, bob: number): void {
  const top = 12 + bob;
  // Backpack peeks out on both sides.
  f.rect(5, top - 2, 14, 6, p.packShade);
  // Legs and boots.
  f.rect(8, 17, 3, 4, p.suitShade);
  f.rect(13, 17, 3, 4, p.suitShade);
  f.rect(8, 21, 3, 2, p.boot);
  f.rect(13, 21, 3, 2, p.boot);
  // Torso, belt, chest panel.
  f.rect(7, top, 10, 6 - bob, p.suit);
  f.rect(15, top, 2, 6 - bob, p.suitShade);
  f.rect(7, top + 4, 10, 1, p.suitShade);
  f.rect(10, top + 1, 4, 2, p.suitShade);
  f.set(11, top + 1, p.glow);
  f.set(12, top + 2, p.accent);
  if (id === 'engineer') f.set(14, top + 1, 0xd03030);
  if (id === 'biologist') f.rect(10, top + 1, 4, 2, p.accent);
  // Arms and gloves.
  f.rect(5, top + 1, 2, 4, p.suitShade);
  f.rect(17, top + 1, 2, 4, p.suitShade);
  f.rect(5, top + 5, 2, 1, p.boot);
  f.rect(17, top + 5, 2, 1, p.boot);
  f.rect(8, top - 1, 8, 1, p.packShade); // collar ring
  helmet(f, p, id, 12, 7 + bob, false);
}

interface Pose {
  /** Horizontal foot offsets from the hip for the near and far leg. */
  near: number;
  far: number;
  /** Lift of each foot off the ground. */
  nearLift: number;
  farLift: number;
  bob: number;
  /** Near arm swing (opposite to the near leg); the far arm swings the other way. */
  arm: number;
}

/** Side view facing right. The far leg and arm are darker so the stride reads clearly. */
function side(f: Frame, p: Palette, id: CrewClassId, pose: Pose): void {
  const hipY = 16 + pose.bob,
    hipX = 11;
  const leg = (dx: number, lift: number, colour: number, boot: number, knee: number): void => {
    const footY = CREW_FEET_Y - 1 - lift;
    for (let y = hipY; y < footY; y++) {
      const k = (y - hipY) / Math.max(1, footY - hipY);
      f.rect(hipX + dx * k, y, 3, 1, colour);
      if (y === hipY + 2) f.set(hipX + dx * k + 2, y, knee);
    }
    f.rect(hipX + dx, footY, 4, 2, boot);
  };
  leg(pose.far, pose.farLift, p.packShade, OUTLINE, p.packShade);
  f.rect(12 - pose.arm, hipY - 4, 2, 4, p.packShade); // far arm
  // Backpack.
  f.rect(5, hipY - 8, 4, 7, p.pack);
  f.rect(5, hipY - 2, 4, 1, p.packShade);
  if (id === 'biologist') f.rect(6, hipY - 7, 2, 4, p.glow); // green sample tank
  if (id === 'engineer') f.set(6, hipY - 6, p.accent);
  if (id === 'scout') f.set(6, hipY - 6, p.accent);
  // Torso.
  f.rect(9, hipY - 5, 7, 6, p.suit);
  f.rect(9, hipY - 5, 2, 6, p.suitShade);
  f.rect(9, hipY - 1, 7, 1, p.suitShade);
  f.set(14, hipY - 3, p.glow);
  if (id === 'scout') f.rect(11, hipY - 4, 5, 1, p.accent);
  leg(pose.near, pose.nearLift, p.suit, p.boot, p.accent);
  // Near arm in front of the body.
  f.rect(12 + pose.arm, hipY - 4, 2, 4, p.suitShade);
  f.rect(12 + pose.arm, hipY, 2, 1, p.boot);
  helmet(f, p, id, 12, 7 + pose.bob, true);
}

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

const WALK: Pose[] = [
  { near: 3, far: -3, nearLift: 0, farLift: 0, bob: 0, arm: -2 }, // contact
  { near: 0, far: 1, nearLift: 0, farLift: 2, bob: -1, arm: 0 }, // passing, far foot up
  { near: -3, far: 3, nearLift: 0, farLift: 0, bob: 0, arm: 2 }, // contact, other foot
  { near: 1, far: 0, nearLift: 2, farLift: 0, bob: -1, arm: 0 }, // passing, near foot up
];

/** All nine frames of one class as an RGBA strip (CREW_FRAMES * 24) x 24. */
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
