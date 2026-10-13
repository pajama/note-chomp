import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import {
  durationName,
  durationNameWithArticle,
  eventUnits,
  formatBeats,
  measureUnits,
  splitIntoMeasures,
  unitsToDuration,
} from './rhythm';

describe('eventUnits', () => {
  it('counts sixteenths', () => {
    expect(eventUnits({ duration: 'w' })).toBe(16);
    expect(eventUnits({ duration: 'h' })).toBe(8);
    expect(eventUnits({ duration: 'q' })).toBe(4);
    expect(eventUnits({ duration: 'e' })).toBe(2);
  });
  it('adds half for a dot', () => {
    expect(eventUnits({ duration: 'h', dotted: true })).toBe(12);
    expect(eventUnits({ duration: 'e', dotted: true })).toBe(3);
  });
});

describe('measureUnits', () => {
  it('uses beats × 4', () => {
    expect(measureUnits('2/4')).toBe(8);
    expect(measureUnits('3/4')).toBe(12);
    expect(measureUnits('4/4')).toBe(16);
  });
});

describe('unitsToDuration', () => {
  it.each([
    [16, { duration: 'w', dotted: false }],
    [12, { duration: 'h', dotted: true }],
    [8, { duration: 'h', dotted: false }],
    [6, { duration: 'q', dotted: true }],
    [4, { duration: 'q', dotted: false }],
    [3, { duration: 'e', dotted: true }],
    [2, { duration: 'e', dotted: false }],
  ])('%i units', (units, expected) => {
    expect(unitsToDuration(units)).toEqual(expected);
  });
  it('rejects unsupported lengths', () => {
    expect(unitsToDuration(1)).toBeUndefined();
    expect(unitsToDuration(5)).toBeUndefined();
    expect(unitsToDuration(24)).toBeUndefined();
    expect(unitsToDuration(2.5)).toBeUndefined();
  });
});

describe('names', () => {
  it('describes durations for kids', () => {
    expect(durationName(note('C', 4, 'h', true))).toBe('dotted half note');
    expect(durationName(rest('e'))).toBe('eighth rest');
  });
  it('picks "a" or "an"', () => {
    expect(durationNameWithArticle(note('C', 4, 'q'))).toBe('a quarter note');
    expect(durationNameWithArticle(rest('e'))).toBe('an eighth rest');
    expect(durationNameWithArticle(note('C', 4, 'e', true))).toBe('a dotted eighth note');
  });
  it('formats beats', () => {
    expect(formatBeats(2)).toBe('½ beat');
    expect(formatBeats(4)).toBe('1 beat');
    expect(formatBeats(6)).toBe('1½ beats');
    expect(formatBeats(8)).toBe('2 beats');
  });
});

describe('splitIntoMeasures', () => {
  it('returns no measures for no events', () => {
    expect(splitIntoMeasures([], '4/4')).toEqual({ ok: true, value: [] });
  });

  it('splits full measures and keeps an incomplete last measure', () => {
    const events = [note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h'), note('E', 4, 'q')];
    const result = splitIntoMeasures(events, '4/4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]).toMatchObject({ number: 1, filledUnits: 16 });
    expect(result.value[0].events.map((p) => p.startUnit)).toEqual([0, 4, 8]);
    expect(result.value[1]).toMatchObject({ number: 2, filledUnits: 4 });
    expect(result.value[1].events[0]).toMatchObject({ index: 3, startUnit: 0 });
  });

  it('rejects a note that crosses the bar line', () => {
    const events = [note('C', 4, 'h', true), note('D', 4, 'h')];
    const result = splitIntoMeasures(events, '4/4');
    expect(result).toEqual({
      ok: false,
      error: {
        eventIndex: 1,
        measureNumber: 1,
        message: "Measure 1: the half note doesn't fit — only 1 beat is left in this measure.",
      },
    });
  });

  it('rejects a note longer than a whole measure', () => {
    const result = splitIntoMeasures([note('C', 4, 'w')], '3/4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe(
      'Measure 1: a whole note is longer than a whole measure of 3/4.',
    );
  });
});
