import { describe, expect, it } from 'vitest';
import { mmss, returnBudget } from './radarPanels';

describe('returnBudget', () => {
  it('is ok with plenty of oxygen', () => {
    expect(returnBudget(60, 100, 50).level).toBe('ok');
  });
  it('warns when the margin is thin and flags no return when negative', () => {
    expect(returnBudget(10, 450, 50).level).toBe('warn');
    expect(returnBudget(5, 600, 50).level).toBe('lost');
  });
});
describe('mmss', () => {
  it('formats and clamps', () => {
    expect(mmss(75)).toBe('1:15');
    expect(mmss(-3)).toBe('0:00');
  });
});
