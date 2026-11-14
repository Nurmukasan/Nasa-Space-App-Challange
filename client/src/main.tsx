import '@fontsource/silkscreen';
import '@fontsource/vt323';
import { createRoot } from 'react-dom/client';
import { Playground } from './dev/Playground';
import { audio } from './audio';
import { App } from './App';
import { send } from './net/session';
import { snaps } from './state/snapshots';
import { store } from './state/store';
import './ui/theme.css';

// No <StrictMode>: its double-mount in dev would create two Phaser games.
const dev = new URLSearchParams(location.search).get('dev');
createRoot(document.getElementById('root')!).render(
  dev !== null ? <Playground name={dev} /> : <App />,
);
// Audio must unlock inside the first trusted user gesture, including lobby clicks.
window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', () => audio.unlock());

// Open the game with ?debug=1 to get window.rs in the console, e.g.
//   rs.send({ t: 'debug', cmd: 'set_time', n: 500 })   (debug commands work on dev servers only)
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { rs: unknown }).rs = { send, store, snaps };
}
