export const PITCHES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Pitch = (typeof PITCHES)[number];

/** w = whole, h = half, q = quarter, e = eighth */
export const DURATIONS = ['w', 'h', 'q', 'e'] as const;
export type Duration = (typeof DURATIONS)[number];

export const OCTAVES = [3, 4, 5, 6] as const;
export type Octave = (typeof OCTAVES)[number];

export const TIME_SIGNATURES = ['2/4', '3/4', '4/4'] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export interface Note {
  kind: 'note';
  pitch: Pitch;
  octave: Octave;
  duration: Duration;
  dotted?: boolean;
}

export interface Rest {
  kind: 'rest';
  duration: Duration;
  dotted?: boolean;
}

export type MusicEvent = Note | Rest;

export interface Song {
  schemaVersion: 1;
  id: string;
  title: string;
  timeSignature: TimeSignature;
  events: MusicEvent[];
}
