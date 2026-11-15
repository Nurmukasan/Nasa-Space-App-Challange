// Crew body drawing shared by every pose: the pixel frame, the helmet and the front and side
// views. Pure: no DOM. Poses and the sprite sheet are in crewArt.ts.
import type { CrewClassId } from '@rs/shared';

export const CREW_FRAME = 24;
/** Boots stand on this row of the frame. */
export const CREW_FEET_Y = 22;

export interface Palette {
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

export const OUTLINE = 0x12141c;
const VISOR = 0xefe6cf;
const VISOR_SHADE = 0xc4b99e;
const VISOR_HI = 0xffffff;

/** One 24x24 frame as packed 0xRRGGBB, -1 = transparent. */
export class Frame {
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

export function helmet(
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

export function front(f: Frame, p: Palette, id: CrewClassId, bob: number): void {
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

export interface Pose {
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
export function side(f: Frame, p: Palette, id: CrewClassId, pose: Pose): void {
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
