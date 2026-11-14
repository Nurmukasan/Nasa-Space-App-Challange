const dictionaries = import.meta.glob<{ default: Record<string, string> }>('./en/*.ts', {
  eager: true,
});
const en: Record<string, string> = Object.assign(
  {},
  ...Object.values(dictionaries).map((module) => module.default),
);
export function t(key: string, params?: Record<string, string | number>): string {
  let text = en[key] ?? key;
  for (const [name, value] of Object.entries(params ?? {}))
    text = text.replaceAll(`{${name}}`, String(value));
  return text;
}
