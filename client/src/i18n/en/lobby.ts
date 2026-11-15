// All player-facing text lives in i18n files, one file per screen, so that
// people working on different screens never edit the same file.
const en: Record<string, string> = {
  'app.title': 'RED SIGNAL',
  'app.tagline': 'Design the mission. Then survive it.',
  'lobby.name': 'Your name',
  'lobby.namePlaceholder': 'Type a call sign',
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
  'lobby.quick_training': 'Quick start · Training',
  'lobby.scenarios': 'CHOOSE A MISSION',
  'lobby.host_selects': 'The host chooses the mission for everyone.',
  'lobby.scenario.training.title': 'SOL 1 · FIRST STEPS',
  'lobby.scenario.training.brief': 'Learn the suit and read the ground. Bring two samples home.',
  'lobby.scenario.training.duration': '{n} minutes · Guided training',
  'lobby.scenario.signal.title': 'SOL 47 · RED SIGNAL',
  'lobby.scenario.signal.brief':
    'Locate a repeating signal. Recover its source before the launch window closes.',
  'lobby.scenario.signal.duration': '{n} minutes · Story mission',
  'lobby.scenario.free.title': 'FREE MISSION',
  'lobby.scenario.free.brief':
    'Design your own expedition. Explore every known site and meet your science goal.',
  'lobby.scenario.free.duration': '{n} minutes · Classic expedition',
  'lobby.design': 'Design mission',
  'role.mc': 'Mission Control',
  'role.eva': 'EVA astronaut',
  'role.solo': 'Solo (both)',
  // Server error codes (shared/src/protocol.ts ErrorCode).
  'lobby.error.room_not_found': 'No room with that code. Check the code and try again.',
  'lobby.error.room_full': 'That room is full.',
  'lobby.error.game_in_progress': 'That mission has already launched.',
  'lobby.error.bad_request': 'The server did not understand that request.',
  'lobby.error.not_allowed':
    'Pick roles first: one Mission Control and at least one astronaut, or Solo when alone.',
  'lobby.error.class_not_chosen': 'Every astronaut must choose a specialty first.',
  'lobby.error.server_full': 'The server is full. Try again in a minute.',
};

export default en;
