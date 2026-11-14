import type { ClientMsg } from '@rs/shared';
import { send } from '../net/session';
import { audio } from '../audio';
export function command(message: ClientMsg): void {
  audio.sfx('ui_click');
  send(message);
}
