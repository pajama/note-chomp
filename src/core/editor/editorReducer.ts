import { createEmptySong, note, rest } from '../model/factories';
import type { Duration, MusicEvent, Octave, Pitch, Song, TimeSignature } from '../model/types';
import { isInRange, RANGE_LABEL } from '../theory/pitch';
import { durationNameWithArticle, splitIntoMeasures } from '../theory/rhythm';

export const HISTORY_LIMIT = 100;

export type OctaveShift = -1 | 0 | 1;

export interface EditorSnapshot {
  song: Song;
  cursor: number;
}

export interface EditorState extends EditorSnapshot {
  duration: Duration;
  dotted: boolean;
  octaveShift: OctaveShift;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  error: string | null;
  dirty: boolean;
}

export type EditorAction =
  | { type: 'insertNote'; pitch: Pitch; baseOctave: 4 | 5 }
  | { type: 'insertRest' }
  | { type: 'deleteBackward' }
  | { type: 'moveCursor'; delta: number }
  | { type: 'setCursor'; index: number }
  | { type: 'setDuration'; duration: Duration }
  | { type: 'toggleDotted' }
  | { type: 'shiftOctave'; delta: 1 | -1 }
  | { type: 'setTitle'; title: string }
  | { type: 'setTimeSignature'; timeSignature: TimeSignature }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; song: Song }
  | { type: 'markSaved' }
  | { type: 'dismissError' };

export function createEditorState(song: Song = createEmptySong()): EditorState {
  return {
    song,
    cursor: song.events.length,
    duration: 'q',
    dotted: false,
    octaveShift: 0,
    past: [],
    future: [],
    error: null,
    dirty: false,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function commit(state: EditorState, song: Song, cursor: number): EditorState {
  const check = splitIntoMeasures(song.events, song.timeSignature);
  if (!check.ok) return { ...state, error: check.error.message };
  return accept(state, song, cursor);
}

function accept(state: EditorState, song: Song, cursor: number): EditorState {
  return {
    ...state,
    song,
    cursor,
    past: [...state.past, { song: state.song, cursor: state.cursor }].slice(-HISTORY_LIMIT),
    future: [],
    error: null,
    dirty: true,
  };
}

function insert(state: EditorState, event: MusicEvent): EditorState {
  const events = [...state.song.events];
  events.splice(state.cursor, 0, event);
  const check = splitIntoMeasures(events, state.song.timeSignature);
  if (check.ok) return accept(state, { ...state.song, events }, state.cursor + 1);
  if (check.error.eventIndex > state.cursor) {
    const blocked = events[check.error.eventIndex];
    return {
      ...state,
      error:
        `Adding ${durationNameWithArticle(event)} here pushes the notes after it out of line — ` +
        `in measure ${check.error.measureNumber} ${durationNameWithArticle(blocked)} no longer fits. ` +
        'Try a shorter note, or delete a note first.',
    };
  }
  return { ...state, error: check.error.message };
}

/** Backspace: remove the event before the cursor, or — if that would break the bar lines — turn it into a rest. */
function deleteBackward(state: EditorState): EditorState {
  if (state.cursor === 0) return state;
  const target = state.cursor - 1;
  const removed = state.song.events.filter((_, i) => i !== target);
  if (splitIntoMeasures(removed, state.song.timeSignature).ok) {
    return accept(state, { ...state.song, events: removed }, target);
  }
  const old = state.song.events[target];
  if (old.kind === 'rest') return { ...state, cursor: target, error: null };
  const events = [...state.song.events];
  events[target] = rest(old.duration, old.dotted ?? false);
  return accept(state, { ...state.song, events }, target);
}

function rangeMessage(pitch: Pitch, octave: number): string {
  return `That ${pitch} is too ${octave < 4 ? 'low' : 'high'} — Note Chomp notes go from the G below middle C up to high C (${RANGE_LABEL}).`;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'insertNote': {
      const octave = action.baseOctave + state.octaveShift;
      if (!isInRange(action.pitch, octave))
        return { ...state, error: rangeMessage(action.pitch, octave) };
      return insert(state, note(action.pitch, octave as Octave, state.duration, state.dotted));
    }
    case 'insertRest':
      return insert(state, rest(state.duration, state.dotted));
    case 'deleteBackward':
      return deleteBackward(state);
    case 'moveCursor':
      return { ...state, cursor: clamp(state.cursor + action.delta, 0, state.song.events.length) };
    case 'setCursor':
      return { ...state, cursor: clamp(action.index, 0, state.song.events.length) };
    case 'setDuration':
      // dotted eighths are not offered
      return {
        ...state,
        duration: action.duration,
        dotted: action.duration === 'e' ? false : state.dotted,
      };
    case 'toggleDotted':
      if (state.duration === 'e') return state;
      return { ...state, dotted: !state.dotted };
    case 'shiftOctave':
      return {
        ...state,
        octaveShift: clamp(state.octaveShift + action.delta, -1, 1) as OctaveShift,
      };
    case 'setTitle':
      return { ...state, song: { ...state.song, title: action.title }, dirty: true };
    case 'setTimeSignature':
      if (action.timeSignature === state.song.timeSignature) return state;
      return commit(state, { ...state.song, timeSignature: action.timeSignature }, state.cursor);
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        song: { ...previous.song, title: state.song.title },
        cursor: previous.cursor,
        past: state.past.slice(0, -1),
        future: [{ song: state.song, cursor: state.cursor }, ...state.future],
        error: null,
        dirty: true,
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        song: { ...next.song, title: state.song.title },
        cursor: next.cursor,
        past: [...state.past, { song: state.song, cursor: state.cursor }],
        future: state.future.slice(1),
        error: null,
        dirty: true,
      };
    }
    case 'load':
      return createEditorState(action.song);
    case 'markSaved':
      return { ...state, dirty: false };
    case 'dismissError':
      return { ...state, error: null };
  }
}
