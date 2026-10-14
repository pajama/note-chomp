import { describe, expect, it } from 'vitest';
import { clampedStepPitch, fromDiatonicIndex, stepPitch, toNoteName } from './pitch';

describe('stepPitch', () => {
  it.each([
    ['E', 4, 2, { pitch: 'G', octave: 4 }],
    ['B', 4, 1, { pitch: 'C', octave: 5 }],
    ['C', 5, -1, { pitch: 'B', octave: 4 }],
    ['A', 5, 2, { pitch: 'C', octave: 6 }],
    ['A', 3, -1, { pitch: 'G', octave: 3 }],
    ['F', 4, 0, { pitch: 'F', octave: 4 }],
  ] as const)('%s%i moved %i steps', (pitch, octave, delta, expected) => {
    expect(stepPitch(pitch, octave, delta)).toEqual(expected);
  });

  it('gives up outside G3–C6', () => {
    expect(stepPitch('G', 3, -1)).toBeUndefined();
    expect(stepPitch('C', 6, 1)).toBeUndefined();
  });
});

describe('clampedStepPitch', () => {
  it('stops at the top and bottom of the range', () => {
    expect(clampedStepPitch('A', 5, 5)).toEqual({ pitch: 'C', octave: 6 });
    expect(clampedStepPitch('A', 3, -4)).toEqual({ pitch: 'G', octave: 3 });
    expect(clampedStepPitch('E', 4, -3)).toEqual({ pitch: 'B', octave: 3 });
  });
});

describe('fromDiatonicIndex', () => {
  it('is the inverse of diatonicIndex inside the range', () => {
    expect(fromDiatonicIndex(4 * 7 + 2)).toEqual({ pitch: 'E', octave: 4 });
    expect(fromDiatonicIndex(3 * 7 + 3)).toBeUndefined(); // F3
    expect(fromDiatonicIndex(2.5)).toBeUndefined();
  });
});

describe('toNoteName', () => {
  it('writes scientific pitch names', () => {
    expect(toNoteName('C', 4)).toBe('C4');
    expect(toNoteName('G', 3)).toBe('G3');
  });
});
