import { describe, expect, it } from 'vitest';
import type { EvaState } from '@rs/shared';
import { Assistant, TYPE_MS, alarmFor, mouthFor } from './assistant';

const snap = (over: Partial<EvaState>): EvaState =>
  ({
    t: 100,
    hazards: [],
    seismic: [],
    flare: null,
    weather: { storm: null },
    ...over,
  }) as unknown as EvaState;

describe('AI assistant', () => {
  it('opens the mouth on vowels and shuts it on pauses', () => {
    expect(mouthFor('a')).toBe(2);
    expect(mouthFor('t')).toBe(1);
    expect(mouthFor(' ')).toBe(0);
    expect(mouthFor('.')).toBe(0);
    expect(mouthFor(undefined)).toBe(0);
  });

  it('types a line, moves the mouth while typing, then falls silent', () => {
    const a = new Assistant();
    a.say('Hello there', { mood: 'happy', holdMs: 500 });
    expect(a.look(0).text).toBe('');
    const mouths = new Set<number>();
    for (let ms = 0; ms < 11 * TYPE_MS; ms += 10) mouths.add(a.look(ms).mouth);
    expect([...mouths].sort()).toEqual([0, 1, 2]);
    const done = a.look(11 * TYPE_MS + 10);
    expect(done.text).toBe('Hello there');
    expect(done.mouth).toBe(0);
    expect(done.mood).toBe('happy');
    expect(a.look(11 * TYPE_MS + 600).text).toBeNull();
  });

  it('plays queued lines in order and can be silenced', () => {
    const a = new Assistant();
    a.say('One', { holdMs: 0 });
    a.say('Two', { holdMs: 0 });
    a.look(0);
    expect(a.look(3 * TYPE_MS + 1).text).toBe(''); // second line started
    expect(a.look(3 * TYPE_MS + 1 + 2 * TYPE_MS).text).toBe('Tw');
    a.silence();
    expect(a.look(10_000).text).toBeNull();
    expect(a.speaking).toBe(false);
  });

  it('switches the face to alarm while a danger is active', () => {
    const a = new Assistant();
    a.setAlarm('quake');
    expect(a.look(0)).toMatchObject({ mood: 'alarm', alarm: 'quake', text: null });
    a.setAlarm(null);
    expect(a.look(0).mood).toBe('neutral');
  });

  it('raises alarms only from what the crew may know', () => {
    expect(alarmFor(snap({}))).toBeNull();
    const event = { t0: 90, deadline: 110, truth: null } as never;
    expect(alarmFor(snap({ seismic: [event] }))).toBe('quake');
    expect(
      alarmFor(snap({ seismic: [{ t0: 90, deadline: 110, truth: 'quake' } as never] })),
    ).toBeNull();
    expect(alarmFor(snap({ flare: { warnAt: 95, tStart: 125, tEnd: 150 } }))).toBe('flare');
    expect(alarmFor(snap({ weather: { storm: { tStart: 130, tEnd: 220 } } as never }))).toBe(
      'storm',
    );
    expect(alarmFor(snap({ hazards: [{} as never], seismic: [event] }))).toBe('rockfall');
  });
});
