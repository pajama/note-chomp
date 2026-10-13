import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import { splitIntoMeasures } from '../theory/rhythm';
import { breakIntoSystems, eventAdvance, measureWidth } from './spacing';

describe('eventAdvance', () => {
  it('grows with duration and dots', () => {
    expect(eventAdvance(note('C', 4, 'e'))).toBeCloseTo(1.9);
    expect(eventAdvance(note('C', 4, 'q'))).toBeCloseTo(2.4);
    expect(eventAdvance(note('C', 4, 'q', true))).toBeCloseTo(2.9);
    expect(eventAdvance(rest('w'))).toBeCloseTo(4.4);
  });
});

describe('measureWidth', () => {
  it('adds bar padding and end padding to the advances', () => {
    const result = splitIntoMeasures(
      [note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h')],
      '4/4',
    );
    if (!result.ok) throw new Error('fixture invalid');
    expect(measureWidth(result.value[0])).toBeCloseTo(1.0 + 2.4 + 2.4 + 3.2 + 0.4);
  });
});

describe('breakIntoSystems', () => {
  it('packs measures greedily', () => {
    expect(breakIntoSystems([10, 10, 10, 10, 10], 25)).toEqual([[0, 1], [2, 3], [4]]);
  });
  it('gives an over-wide measure its own system', () => {
    expect(breakIntoSystems([5, 40, 5], 25)).toEqual([[0], [1], [2]]);
  });
  it('returns nothing for no measures', () => {
    expect(breakIntoSystems([], 25)).toEqual([]);
  });
});
