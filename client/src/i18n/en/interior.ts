// Inside the lander: room prompts and the AI assistant's lines.
// Dialogue scripts can add more keys here and call assistant.say(t('...')).
export default {
  'interior.prompt.sleep': 'E · SLEEP',
  'interior.prompt.work': 'E · WORK',
  'interior.prompt.tend': 'E · TEND PLANTS',
  'interior.prompt.talk': 'E · TALK TO ARIA',
  'interior.prompt.exit': 'E · CYCLE AIRLOCK',
  'interior.prompt.stand': 'E / WASD · STAND UP',
  'interior.ai.name': 'ARIA',
  'interior.header': 'TULPAR-1 · {clock} · O2 STORE {o2}%',
  'interior.controls': 'WASD MOVE · E USE',
  'interior.controls_solo': 'WASD MOVE · E USE · TAB CONSOLE',
  'interior.ai.welcome': 'Welcome back. Air is good, doors are sealed.',
  'interior.ai.status.clear': 'All systems nominal. Rest while you can.',
  'interior.ai.status.quake': 'Seismic event in progress. Stay inside until it settles.',
  'interior.ai.status.storm': 'Dust storm on the way. Solar output will drop.',
  'interior.ai.status.flare': 'Solar flare. Radiation outside: stay in the shelter.',
  'interior.ai.status.rockfall': 'Rockfall warning near the ledges. Keep the crew clear.',
  'interior.alarm.quake': 'Alert! Seismic signal detected!',
  'interior.alarm.storm': 'Alert! Dust storm approaching!',
  'interior.alarm.flare': 'Alert! Solar flare warning!',
  'interior.alarm.rockfall': 'Alert! Rockfall imminent!',
};
