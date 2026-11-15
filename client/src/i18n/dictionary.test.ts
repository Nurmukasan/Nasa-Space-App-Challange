import { describe, expect, it } from 'vitest';

// All en/*.ts dictionaries merge into one: a key defined twice silently loses one text.
const files = import.meta.glob<{ default: Record<string, string> }>('./en/*.ts', { eager: true });

describe('i18n dictionaries', () => {
  it('define every key exactly once across files', () => {
    const owner = new Map<string, string>();
    const twice: string[] = [];
    for (const [file, module] of Object.entries(files))
      for (const key of Object.keys(module.default)) {
        const first = owner.get(key);
        if (first) twice.push(`${key}: ${first} and ${file}`);
        else owner.set(key, file);
      }
    expect(twice).toEqual([]);
  });
});
