import { describe, expect, it } from 'vitest';
import { dotUnavailable, durationTooLong } from './durationChoices';

describe('durationTooLong', () => {
  it('only rules out notes longer than the measure', () => {
    expect(durationTooLong('w', '4/4')).toBe(false);
    expect(durationTooLong('w', '3/4')).toBe(true);
    expect(durationTooLong('w', '2/4')).toBe(true);
    expect(durationTooLong('h', '2/4')).toBe(false);
  });
});

describe('dotUnavailable', () => {
  it('never offers dotted eighths', () => {
    expect(dotUnavailable('e', '4/4')).toBe("Dotted eighths aren't available yet");
  });
  it('rules out dotted notes that overflow the measure', () => {
    expect(dotUnavailable('h', '2/4')).toBe('Too long for 2/4');
    expect(dotUnavailable('w', '4/4')).toBe('Too long for 4/4');
  });
  it('allows dots that fit', () => {
    expect(dotUnavailable('h', '3/4')).toBeNull();
    expect(dotUnavailable('q', '2/4')).toBeNull();
  });
});
