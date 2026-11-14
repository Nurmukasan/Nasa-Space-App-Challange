// All player-facing text lives in i18n files, one file per screen, so that
// people working on different screens never edit the same file.
const en: Record<string, string> = {
  'app.title': 'RED SIGNAL',
  'app.tagline': 'Design the mission. Then survive it.',
  'lobby.name': 'Call sign',
  'lobby.create': 'Create room',
  'lobby.join': 'Join',
  'lobby.solo': 'Play solo (offline)',
  'lobby.server.online': 'Server online',
  'lobby.server.offline': 'Server offline: solo play only',
  'lobby.server.checking': 'Checking server...',
  'lobby.crew': 'Crew',
  'lobby.host': 'Host',
  'lobby.code': 'Room code',
  'lobby.quick': 'Quick start',
  'lobby.design': 'Design mission',
  'role.mc': 'Mission Control',
  'role.eva': 'EVA astronaut',
  'role.solo': 'Solo (both)',
};

export default en;
