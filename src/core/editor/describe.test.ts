import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import { describeEvent } from './describe';

describe('describeEvent', () => {
  it('names notes by letter and length, counting from 1', () => {
    expect(describeEvent(note('G', 4, 'q'), 2)).toBe('Note 3: G, quarter note');
    expect(describeEvent(note('C', 5, 'h', true), 0)).toBe('Note 1: C, dotted half note');
  });
  it('names rests by length', () => {
    expect(describeEvent(rest('e'), 3)).toBe('Note 4: eighth rest');
  });
  it('adds selected and playing', () => {
    expect(describeEvent(note('E', 4, 'w'), 0, { selected: true })).toBe(
      'Note 1: E, whole note, selected',
    );
    expect(describeEvent(note('E', 4, 'w'), 0, { selected: true, playing: true })).toBe(
      'Note 1: E, whole note, selected, playing',
    );
  });
});
