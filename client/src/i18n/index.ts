const dictionaries = import.meta.glob<{ default: Record<string, string> }>('./en/*.ts', {
  eager: true,
});
const en = Object.assign({}, ...Object.values(dictionaries).map((m) => m.default)) as Record<
  string,
  string
>;
export function t(key: string, params?: Record<string, string | number>): string {
  let text = en[key] ?? key;
  for (const [k, v] of Object.entries(params ?? {})) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}
