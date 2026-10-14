import { createEmptySong, note, rest } from '../model/factories';
import type { Duration, MusicEvent, Octave, Pitch, Song, TimeSignature } from '../model/types';
import { isInRange, RANGE_LABEL } from '../theory/pitch';
import { durationNameWithArticle, splitIntoMeasures, type MeasureError } from '../theory/rhythm';

export const HISTORY_LIMIT = 100;

export type OctaveShift = -1 | 0 | 1;

export interface EditorSnapshot {
  song: Song;
  /** Insert position: gap 0..events.length. */
  cursor: number;
  /** Index of the selected event, or null when the insert cursor is active. */
  selection: number | null;
}

export interface EditorState extends EditorSnapshot {
  duration: Duration;
  dotted: boolean;
  octaveShift: OctaveShift;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  error: string | null;
  /** The measure the current error is about (for a flash on the staff), if known. */
  errorMeasure: number | null;
  dirty: boolean;
}

export type EditorAction =
  | { type: 'insertNote'; pitch: Pitch; baseOctave: 4 | 5 }
  | { type: 'insertRest' }
  | { type: 'deleteBackward' }
  | { type: 'moveCursor'; delta: number }
  | { type: 'setCursor'; index: number }
  | { type: 'select'; index: number }
  | { type: 'clearSelection' }
  | { type: 'navigate'; delta: number }
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
    selection: null,
    duration: 'q',
    dotted: false,
    octaveShift: 0,
    past: [],
    future: [],
    error: null,
    errorMeasure: null,
    dirty: false,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const snapshot = (state: EditorState): EditorSnapshot => ({
  song: state.song,
  cursor: state.cursor,
  selection: state.selection,
});

function reject(state: EditorState, message: string, measure: number | null = null): EditorState {
  return { ...state, error: message, errorMeasure: measure };
}

function commit(state: EditorState, song: Song, cursor: number): EditorState {
  const check = splitIntoMeasures(song.events, song.timeSignature);
  if (!check.ok) return reject(state, check.error.message, check.error.measureNumber);
  return accept(state, song, cursor, state.selection);
}

function accept(
  state: EditorState,
  song: Song,
  cursor: number,
  selection: number | null = null,
): EditorState {
  return {
    ...state,
    song,
    cursor,
    selection,
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
    future: [],
    error: null,
    errorMeasure: null,
    dirty: true,
  };
}

function pushedOutMessage(lead: string, error: MeasureError, events: MusicEvent[]): string {
  return (
    `${lead} pushes the notes after it out of line — ` +
    `in measure ${error.measureNumber} ${durationNameWithArticle(events[error.eventIndex])} no longer fits. ` +
    'Try a shorter note, or delete a note first.'
  );
}

function insert(state: EditorState, event: MusicEvent): EditorState {
  const events = [...state.song.events];
  events.splice(state.cursor, 0, event);
  const check = splitIntoMeasures(events, state.song.timeSignature);
  if (check.ok) return accept(state, { ...state.song, events }, state.cursor + 1);
  const lead = `Adding ${durationNameWithArticle(event)} here`;
  const message =
    check.error.eventIndex > state.cursor
      ? pushedOutMessage(lead, check.error, events)
      : check.error.message;
  return reject(state, message, check.error.measureNumber);
}

/** Backspace without a selection: remove the event before the cursor, or — if that would break the bar lines — turn it into a rest. */
function deleteBackward(state: EditorState): EditorState {
  if (state.cursor === 0) return state;
  const target = state.cursor - 1;
  const removed = state.song.events.filter((_, i) => i !== target);
  if (splitIntoMeasures(removed, state.song.timeSignature).ok) {
    return accept(state, { ...state.song, events: removed }, target);
  }
  const old = state.song.events[target];
  if (old.kind === 'rest') return { ...state, cursor: target, error: null, errorMeasure: null };
  const events = [...state.song.events];
  events[target] = rest(old.duration, old.dotted ?? false);
  return accept(state, { ...state.song, events }, target);
}

function rangeMessage(pitch: Pitch, octave: number): string {
  return `That ${pitch} is too ${octave < 4 ? 'low' : 'high'} — Note Chomp notes go from the G below middle C up to high C (${RANGE_LABEL}).`;
}

function select(state: EditorState, index: number): EditorState {
  const count = state.song.events.length;
  if (count === 0) return state;
  const selection = clamp(index, 0, count - 1);
  return { ...state, selection, cursor: selection + 1, error: null, errorMeasure: null };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'insertNote': {
      const octave = action.baseOctave + state.octaveShift;
      if (!isInRange(action.pitch, octave))
        return reject(state, rangeMessage(action.pitch, octave));
      return insert(state, note(action.pitch, octave as Octave, state.duration, state.dotted));
    }
    case 'insertRest':
      return insert(state, rest(state.duration, state.dotted));
    case 'deleteBackward':
      return deleteBackward(state);
    case 'moveCursor':
      return {
        ...state,
        selection: null,
        cursor: clamp(state.cursor + action.delta, 0, state.song.events.length),
      };
    case 'setCursor':
      return {
        ...state,
        selection: null,
        cursor: clamp(action.index, 0, state.song.events.length),
      };
    case 'select':
      return select(state, action.index);
    case 'clearSelection':
      if (state.selection === null) return state;
      return { ...state, selection: null, cursor: state.selection + 1 };
    case 'navigate': {
      // Walk gap 0, note 0, gap 1, note 1, …, gap N: even positions are gaps, odd ones notes.
      const count = state.song.events.length;
      const position = state.selection !== null ? 2 * state.selection + 1 : 2 * state.cursor;
      const next = clamp(position + action.delta, 0, 2 * count);
      if (next % 2 === 1) return select(state, (next - 1) / 2);
      return { ...state, selection: null, cursor: next / 2, error: null, errorMeasure: null };
    }
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
        selection: previous.selection,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
        error: null,
        errorMeasure: null,
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
        selection: next.selection,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(1),
        error: null,
        errorMeasure: null,
        dirty: true,
      };
    }
    case 'load':
      return createEditorState(action.song);
    case 'markSaved':
      return { ...state, dirty: false };
    case 'dismissError':
      return { ...state, error: null, errorMeasure: null };
  }
}
