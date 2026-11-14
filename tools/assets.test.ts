// Asset validator. Runs in `npm test` and CI, so a wrongly named or sized file
// fails the check instead of breaking the game. Rules: docs/assets.md.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ASSETS, ASSET_LIMITS } from '../client/src/game/assetManifest';
import { MUSIC_NAMES, SFX_NAMES } from '../client/src/audio/soundManifest';

const ROOT = fileURLToPath(new URL('../client/public/assets/', import.meta.url));
const SPRITES = join(ROOT, 'sprites');
const SFX_DIR = join(ROOT, 'audio', 'sfx');
const MUSIC_DIR = join(ROOT, 'audio', 'music');
const IGNORED = new Set(['.gitkeep', '.DS_Store', 'Thumbs.db']);

function list(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((name) => !IGNORED.has(name)) : [];
}

function pngSize(file: string): { width: number; height: number } | null {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  if (b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

describe('asset manifest', () => {
  it('has unique keys and positive sizes', () => {
    const keys = ASSETS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of ASSETS) {
      expect(a.width > 0 && a.height > 0 && a.frames > 0, a.key).toBe(true);
      expect(a.key, a.key).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe('client/public/assets/sprites', () => {
  it('contains only manifest PNGs with exact frame sizes', () => {
    const problems: string[] = [];
    for (const name of list(SPRITES)) {
      const file = join(SPRITES, name);
      if (statSync(file).isDirectory()) {
        problems.push(`${name}/: no sub-folders here; put art sources in art-src/`);
        continue;
      }
      if (!name.endsWith('.png')) {
        problems.push(`${name}: only .png belongs here; put sources (.aseprite, .psd) in art-src/`);
        continue;
      }
      const key = name.slice(0, -4);
      const spec = ASSETS.find((a) => a.key === key);
      if (!spec) {
        problems.push(`${name}: unknown name; use a key from docs/assets.md (lower case)`);
        continue;
      }
      const size = pngSize(file);
      const want = { width: spec.width * spec.frames, height: spec.height };
      if (!size) problems.push(`${name}: not a valid PNG file`);
      else if (size.width !== want.width || size.height !== want.height)
        problems.push(
          `${name}: expected ${want.width}×${want.height} (${spec.frames} frame(s) of ` +
            `${spec.width}×${spec.height} in one row), got ${size.width}×${size.height}`,
        );
      const bytes = statSync(file).size;
      if (bytes > ASSET_LIMITS.spriteBytes)
        problems.push(`${name}: ${kb(bytes)} is over ${kb(ASSET_LIMITS.spriteBytes)}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('client/public/assets/audio', () => {
  const formats = ['.ogg', '.mp3', '.wav'];
  const check = (dir: string, names: readonly string[], limit: number, folder: string) => {
    const problems: string[] = [];
    for (const name of list(dir)) {
      const dot = name.lastIndexOf('.');
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
      if (!formats.includes(ext)) {
        problems.push(`${folder}/${name}: use .ogg (+ .mp3 copy) or short .wav`);
        continue;
      }
      if (!names.includes(base)) {
        const other = folder === 'sfx' ? MUSIC_NAMES : SFX_NAMES;
        problems.push(
          (other as readonly string[]).includes(base)
            ? `${folder}/${name}: right name, wrong folder`
            : `${folder}/${name}: unknown sound name; see docs/assets.md`,
        );
        continue;
      }
      const bytes = statSync(join(dir, name)).size;
      if (bytes > limit) problems.push(`${folder}/${name}: ${kb(bytes)} is over ${kb(limit)}`);
    }
    return problems;
  };

  it('sfx/ holds only known effect names within the size limit', () => {
    expect(check(SFX_DIR, SFX_NAMES, ASSET_LIMITS.sfxBytes, 'sfx')).toEqual([]);
  });

  it('music/ holds only known music, sting and ambience names within the size limit', () => {
    expect(check(MUSIC_DIR, MUSIC_NAMES, ASSET_LIMITS.musicBytes, 'music')).toEqual([]);
  });
});
