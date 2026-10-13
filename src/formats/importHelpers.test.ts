import { describe, expect, it } from 'vitest';
import { rest } from '../core/model/factories';
import { fillRests, lengthError, rangeError } from './importHelpers';

describe('fillRests', () => {
  it('uses the fewest rests, largest first', () => {
    expect(fillRests(12)).toEqual([rest('h', true)]);
    expect(fillRests(8)).toEqual([rest('h')]);
    expect(fillRests(14)).toEqual([rest('h', true), rest('e')]);
    expect(fillRests(10)).toEqual([rest('h'), rest('e')]);
    expect(fillRests(0)).toEqual([]);
  });

  it('gives up on lengths no rest can make', () => {
    expect(fillRests(3)).toBeUndefined();
    expect(fillRests(1.5)).toBeUndefined();
  });
});

describe('importer messages', () => {
  it('describes out-of-range notes in plain words', () => {
    expect(rangeError(2, 'C', 3)).toBe(
      "Measure 2: a C that low is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
    );
    expect(rangeError(1, 'F', 3)).toMatch(/^Measure 1: an F that low /);
    expect(rangeError(4, 'D', 6)).toMatch(/^Measure 4: a D that high /);
  });

  it('describes unsupported lengths in plain words', () => {
    expect(lengthError(1, 'C')).toBe(
      "Measure 1: one C has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).",
    );
    expect(lengthError(3, 'rest')).toMatch(/^Measure 3: one rest has a length/);
  });
});
