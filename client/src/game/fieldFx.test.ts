import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvaState } from '@rs/shared';
import { audio } from '../audio';
import { fxBus } from '../fx/FxBus';
import { FieldFx } from './fieldFx';
vi.mock('../audio', () => ({
  audio: { sfx: vi.fn(), stopEva: vi.fn(), step: vi.fn(), setStorm: vi.fn() },
}));
vi.mock('../state/prefs', () => ({ prefs: { getState: () => ({ reduceMotion: false }) } }));
class SceneEvents {
  private target = new EventTarget();
  once(name: string, handler: () => void) {
    this.target.addEventListener(name, handler, { once: true });
  }
  off(name: string, handler: () => void) {
    this.target.removeEventListener(name, handler);
  }
  emit(name: string) {
    this.target.dispatchEvent(new Event(name));
  }
}
function scene() {
  return {
    events: new SceneEvents(),
    registry: { set: vi.fn() },
    cameras: { main: { shake: vi.fn() } },
  };
}
function tremor(tick = 1) {
  fxBus.consume({ tick, fx: [{ id: 1, t: 0, type: 'tremor' }] } as EvaState);
}
beforeEach(() => fxBus.reset());
afterEach(() => fxBus.reset());
describe('FieldFx lifecycle', () => {
  it.each(['shutdown', 'destroy'])('unsubscribes when a scene emits %s', (event) => {
    const old = scene();
    new FieldFx(old as unknown as Phaser.Scene);
    tremor();
    expect(old.cameras.main.shake).toHaveBeenCalledTimes(1);
    old.events.emit(event);
    fxBus.reset();
    const current = scene();
    new FieldFx(current as unknown as Phaser.Scene);
    tremor();
    expect(old.cameras.main.shake).toHaveBeenCalledTimes(1);
    expect(current.cameras.main.shake).toHaveBeenCalledTimes(1);
    current.events.emit('destroy');
  });
});

it('plays an objective cue once when a snapshot repeats the same effect', () => {
  const current = scene();
  new FieldFx(current as unknown as Phaser.Scene);
  const calls = vi.mocked(audio.sfx).mock.calls.length;
  const snapshot = { tick: 5, fx: [{ id: 7, t: 1, type: 'objective_done' }] } as EvaState;
  fxBus.consume(snapshot);
  fxBus.consume(snapshot);
  expect(vi.mocked(audio.sfx).mock.calls.length).toBe(calls + 1);
  current.events.emit('destroy');
});
