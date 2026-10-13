import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import type { MusicEvent } from '../model/types';
import { splitIntoMeasures } from '../theory/rhythm';
import { findBeamGroups } from './beams';

function firstMeasure(events: MusicEvent[]) {
  const result = splitIntoMeasures(events, '4/4');
  if (!result.ok) throw new Error(result.error.message);
  return result.value[0];
}

describe('findBeamGroups', () => {
  it('pairs eighths within each beat', () => {
    const m = firstMeasure([
      note('C', 4, 'e'),
      note('D', 4, 'e'),
      note('E', 4, 'e'),
      note('F', 4, 'e'),
      note('G', 4, 'h'),
    ]);
    expect(findBeamGroups(m)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('does not beam across a beat boundary', () => {
    const m = firstMeasure([
      note('C', 4, 'q', true),
      note('D', 4, 'e'),
      note('E', 4, 'e'),
      note('F', 4, 'e'),
      note('G', 4, 'q'),
    ]);
    // D4 starts at unit 6 (off-beat), E4 at 8 (on-beat) with F4 at 10 → only [2,3]
    expect(findBeamGroups(m)).toEqual([[2, 3]]);
  });

  it('never beams rests or dotted eighths', () => {
    const m = firstMeasure([
      rest('e'),
      note('D', 4, 'e'),
      note('E', 4, 'e', true),
      note('F', 4, 'e', true),
    ]);
    expect(findBeamGroups(m)).toEqual([]);
  });

  it('uses flags when notes are more than an octave apart', () => {
    const m = firstMeasure([note('G', 3, 'e'), note('C', 5, 'e')]);
    // G3 step -5, C5 step 5 → span 10
    expect(findBeamGroups(m)).toEqual([]);
  });
});
