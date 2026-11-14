// All player-facing text lives in i18n files, one file per screen, so that
// people working on different screens never edit the same file.
const en: Record<string, string> = {
  'app.title': 'RED SIGNAL',
  'app.tagline': 'Design the mission. Then survive it.',
  'lobby.name': 'Call sign',
  'lobby.create': 'Create room',
  'lobby.join': 'Join',
  'lobby.solo': 'Play solo (offline)',
  'lobby.code': 'Room code',
  'lobby.quick': 'Quick start',
  'lobby.design': 'Design mission',
  'role.mc': 'Mission Control',
  'role.eva': 'EVA astronaut',
  'role.solo': 'Solo (both)',
};

export function t(key: string, params?: Record<string, string | number>): string {
  let s = en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
