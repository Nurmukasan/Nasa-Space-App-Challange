import { audio } from './index';
/** One listener pair for all existing and future interface buttons, including keyboard clicks. */
export function installUiSounds(): () => void {
  let hovered: Element | null = null;
  let hoverAt = 0;
  const button = (target: EventTarget | null) =>
    target instanceof Element ? target.closest('button:not(:disabled)') : null;
  const click = (event: MouseEvent) => {
    if (!event.isTrusted || !button(event.target)) return;
    void audio.unlock().then(() => audio.sfx('ui_click', { volume: 0.45 }));
  };
  const hover = (event: PointerEvent) => {
    const next = button(event.target);
    if (next === hovered) return;
    hovered = next;
    if (!next || performance.now() - hoverAt < 80) return;
    hoverAt = performance.now();
    audio.sfx('ui_hover');
  };
  document.addEventListener('click', click, true);
  document.addEventListener('pointerover', hover, true);
  return () => {
    document.removeEventListener('click', click, true);
    document.removeEventListener('pointerover', hover, true);
  };
}
