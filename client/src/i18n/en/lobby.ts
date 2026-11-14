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
  'lobby.quick_training': 'Quick start · Training',
  'lobby.scenarios': 'CHOOSE A MISSION',
  'lobby.host_selects': 'The host chooses the mission for everyone.',
  'lobby.scenario.training.title': 'SOL 1 · FIRST STEPS',
  'lobby.scenario.training.brief': 'Learn the suit and read the ground. Bring two samples home.',
  'lobby.scenario.training.duration': '4 minutes · Guided training',
  'lobby.scenario.signal.title': 'SOL 47 · RED SIGNAL',
  'lobby.scenario.signal.brief':
    'Locate a repeating signal. Recover its source before the launch window closes.',
  'lobby.scenario.signal.duration': '8 minutes · Story mission',
  'lobby.scenario.free.title': 'FREE MISSION',
  'lobby.scenario.free.brief':
    'Design your own expedition. Explore every known site and meet your science goal.',
  'lobby.scenario.free.duration': '10 minutes · Classic expedition',
  'lobby.design': 'Design mission',
  'role.mc': 'Mission Control',
  'role.eva': 'EVA astronaut',
  'role.solo': 'Solo (both)',
};

export default en;
