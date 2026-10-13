import { newSongId } from './id';
import type { Duration, Note, Octave, Pitch, Rest, Song, TimeSignature } from './types';

export function note(pitch: Pitch, octave: Octave, duration: Duration, dotted = false): Note {
  return dotted
    ? { kind: 'note', pitch, octave, duration, dotted: true }
    : { kind: 'note', pitch, octave, duration };
}

export function rest(duration: Duration, dotted = false): Rest {
  return dotted ? { kind: 'rest', duration, dotted: true } : { kind: 'rest', duration };
}

export function createEmptySong(title = 'My Song', timeSignature: TimeSignature = '4/4'): Song {
  return { schemaVersion: 1, id: newSongId(), title, timeSignature, events: [] };
}
