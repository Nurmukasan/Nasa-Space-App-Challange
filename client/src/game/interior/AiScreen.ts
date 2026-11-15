// ARIA's animated face for the lab terminal: a tiny canvas the view scales onto the monitor.
import { prefs } from '../../state/prefs';
import { FACE_H, FACE_W, drawFace } from './interiorProps';
import { assistant } from './assistant';

const FLASH_MS = 300;

export class AiScreen {
  readonly canvas = document.createElement('canvas');
  private key = '';
  /** Line ARIA is typing right now, or null. */
  text: string | null = null;

  constructor() {
    this.canvas.width = FACE_W;
    this.canvas.height = FACE_H;
  }

  /** Advance the assistant to `time`; redraw the face only when it changes. */
  update(time: number): void {
    const look = assistant.look(time);
    const flash = !prefs.getState().reduceMotion && Math.floor(time / FLASH_MS) % 2 === 0;
    const key = `${look.mood}|${look.mouth}|${look.eyesClosed}|${look.alarm}|${flash && !!look.alarm}`;
    if (key !== this.key) {
      this.key = key;
      drawFace(this.canvas.getContext('2d')!, look, flash);
    }
    this.text = look.text || null;
  }
}
