import { describe, expect, it } from 'vitest';
import { isInRange, isOnLine, ledgerSteps, staffStep, stemDirection } from './pitch';

describe('staffStep', () => {
  it.each([
    ['G', 3, -5],
    ['C', 4, -2],
    ['D', 4, -1],
    ['E', 4, 0],
    ['F', 4, 1],
    ['B', 4, 4],
    ['F', 5, 8],
    ['A', 5, 10],
    ['C', 6, 12],
  ] as const)('%s%i → %i', (pitch, octave, step) => {
    expect(staffStep(pitch, octave)).toBe(step);
  });
});

describe('isInRange', () => {
  it('accepts the bounds G3 and C6', () => {
    expect(isInRange('G', 3)).toBe(true);
    expect(isInRange('C', 6)).toBe(true);
  });
  it('rejects F3 and D6', () => {
    expect(isInRange('F', 3)).toBe(false);
    expect(isInRange('D', 6)).toBe(false);
  });
});

describe('stemDirection', () => {
  it('points up below the middle line and down from it', () => {
    expect(stemDirection(3)).toBe('up');
    expect(stemDirection(4)).toBe('down');
    expect(stemDirection(-5)).toBe('up');
  });
});

describe('ledgerSteps', () => {
  it.each([
    [0, []],
    [8, []],
    [9, []],
    [-1, []],
    [-2, [-2]],
    [-3, [-2]],
    [-4, [-2, -4]],
    [-5, [-2, -4]],
    [10, [10]],
    [11, [10]],
    [12, [10, 12]],
  ])('step %i → %j', (step, expected) => {
    expect(ledgerSteps(step)).toEqual(expected);
  });
});

describe('isOnLine', () => {
  it('even steps are on lines', () => {
    expect(isOnLine(0)).toBe(true);
    expect(isOnLine(-2)).toBe(true);
    expect(isOnLine(1)).toBe(false);
    expect(isOnLine(-5)).toBe(false);
  });
});
