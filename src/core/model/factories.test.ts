import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from './factories';
import { newSongId } from './id';

describe('model factories', () => {
  it('builds a note without a dotted flag by default', () => {
    expect(note('C', 4, 'q')).toEqual({ kind: 'note', pitch: 'C', octave: 4, duration: 'q' });
  });
  it('builds a dotted note', () => {
    expect(note('E', 5, 'h', true)).toEqual({
      kind: 'note',
      pitch: 'E',
      octave: 5,
      duration: 'h',
      dotted: true,
    });
  });
  it('builds rests', () => {
    expect(rest('e')).toEqual({ kind: 'rest', duration: 'e' });
    expect(rest('q', true)).toEqual({ kind: 'rest', duration: 'q', dotted: true });
  });
  it('creates an empty 4/4 song with a fresh id', () => {
    const song = createEmptySong();
    expect(song).toMatchObject({
      schemaVersion: 1,
      title: 'My Song',
      timeSignature: '4/4',
      events: [],
    });
    expect(song.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('generates unique ids', () => {
    expect(newSongId()).not.toEqual(newSongId());
  });
});
