/** Original astronaut suits. Pure data plus one drawing routine shared by the field and the lobby. */
export interface Skin {
  id: string;
  suit: string;
  pack: string;
  visor: string;
  boots: string;
  /** Optional small details that make the silhouette readable at 16 px. */
  antenna?: string;
  crest?: string;
  belt?: string;
}

export const SKINS: Skin[] = [
  { id: 'classic', suit: '#e2ecff', pack: '#20243c', visor: '#295868', boots: '#b0b6c4' },
  {
    id: 'dune',
    suit: '#d9b27a',
    pack: '#5a4126',
    visor: '#1d3a44',
    boots: '#8a6a3c',
    belt: '#7b5a30',
  },
  {
    id: 'ember',
    suit: '#d8573a',
    pack: '#3a1712',
    visor: '#ffd9a0',
    boots: '#7a2a1e',
    crest: '#ffce72',
  },
  {
    id: 'frost',
    suit: '#bfe6f2',
    pack: '#1c3446',
    visor: '#12354a',
    boots: '#7fa6b8',
    antenna: '#50e6f0',
  },
  {
    id: 'moss',
    suit: '#8fb878',
    pack: '#24331f',
    visor: '#16261a',
    boots: '#566e48',
    belt: '#ffce72',
  },
  {
    id: 'nightfall',
    suit: '#2e3350',
    pack: '#12142a',
    visor: '#50e6f0',
    boots: '#4a5070',
    belt: '#50e6f0',
  },
  {
    id: 'gold',
    suit: '#f0c04a',
    pack: '#4a3410',
    visor: '#5a3a10',
    boots: '#c69a2c',
    crest: '#fff0b0',
  },
];

export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0]!;
export const skinKey = (id: string): string => `astronaut_skin_${skinById(id).id}`;

/** Nine 16x16 frames in the same layout as the base astronaut sheet. */
export function skinSheet(skin: Skin): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16 * 9;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  for (let frame = 0; frame < 9; frame++) {
    ctx.save();
    ctx.translate(frame * 16, 0);
    const bob = frame >= 2 && frame < 6 ? frame % 2 : 0;
    if (frame === 8) {
      ctx.fillStyle = skin.boots;
      ctx.fillRect(2, 10, 12, 5);
      ctx.fillStyle = skin.suit;
      ctx.fillRect(3, 9, 10, 4);
    } else {
      ctx.fillStyle = skin.pack;
      ctx.fillRect(3, 3 + bob, 10, 11);
      ctx.fillStyle = skin.suit;
      ctx.fillRect(4, 2 + bob, 8, 7);
      ctx.fillRect(4, 9, 8, 4);
      ctx.fillStyle = skin.visor;
      ctx.fillRect(6, 4 + bob, 5, 3);
      ctx.fillStyle = skin.boots;
      ctx.fillRect(4, 13, 3, 2 - bob);
      ctx.fillRect(9, 13, 3, 1 + bob);
      if (skin.belt) {
        ctx.fillStyle = skin.belt;
        ctx.fillRect(4, 10, 8, 1);
      }
      if (skin.crest) {
        ctx.fillStyle = skin.crest;
        ctx.fillRect(7, 1 + bob, 2, 1);
      }
      if (skin.antenna) {
        ctx.fillStyle = skin.antenna;
        ctx.fillRect(11, bob, 1, 3);
      }
      if (frame >= 6 && frame < 8) {
        ctx.fillStyle = '#ffce72';
        ctx.fillRect(12, 8, 2, 7);
      }
    }
    ctx.restore();
  }
  return canvas;
}

/** Registers one Phaser texture per skin; safe to call on every scene start. */
export function ensureSkins(textures: {
  exists(key: string): boolean;
  addCanvas(
    key: string,
    canvas: HTMLCanvasElement,
  ): {
    add(frame: number, source: number, x: number, y: number, w: number, h: number): unknown;
  } | null;
}): void {
  for (const skin of SKINS) {
    const key = skinKey(skin.id);
    if (textures.exists(key)) continue;
    const texture = textures.addCanvas(key, skinSheet(skin));
    for (let frame = 0; frame < 9; frame++) texture?.add(frame, 0, frame * 16, 0, 16, 16);
  }
}
