import { describe, expect, it } from 'vitest';
import type { LogEntry, PlayerInfo } from '@rs/shared';
import { radioText, radioVoice } from './radioText';

const crew = [{ id: 'x7k2ab9', name: 'AIGERIM' }] as PlayerInfo[];
const line = (key: string, params?: LogEntry['params']): LogEntry => ({
  id: 1,
  t: 10,
  from: 'sys',
  key,
  params,
});

describe('radio text', () => {
  it('shows the call sign instead of the player id', () => {
    expect(radioText(line('log.down', { id: 'x7k2ab9' }), crew)).toContain('AIGERIM');
    expect(radioText(line('log.down', { id: 'x7k2ab9' }), crew)).not.toContain('x7k2ab9');
  });
  it('keeps unknown ids and other params as they are', () => {
    expect(radioText(line('log.lost', { id: 'ghost' }), crew)).toContain('ghost');
    expect(radioText(line('log.sample_collected', { tier: 'deep', value: 32 }), crew)).toContain(
      '32',
    );
  });
  it('speaks for the onboard computer on sys lines', () => {
    expect(radioVoice('sys')).toBe('tulpar');
    expect(radioVoice('earth')).toBe('earth');
    expect(radioVoice('x7k2ab9')).toBe('crew');
  });
});
