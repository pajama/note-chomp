import { createEmptySong, note, rest } from '../model/factories';
import type {
  Duration,
  MusicEvent,
  Note,
  Octave,
  Pitch,
  Song,
  TimeSignature,
} from '../model/types';
import { clampedStepPitch, isInRange, RANGE_LABEL, stepPitch } from '../theory/pitch';
import {
  durationNameWithArticle,
  eventUnits,
  fillUnits,
  splitIntoMeasures,
  type MeasureError,
} from '../theory/rhythm';

export const HISTORY_LIMIT = 100;

export type OctaveShift = -1 | 0 | 1;

export interface EditorSnapshot {
  song: Song;
  /** Insert position: gap 0..events.length. */
  cursor: number;
  /** Index of the selected event, or null when the insert cursor is active. */
  selection: number | null;
}

/** A pointer drag in progress: where the note started and the state to undo back to. */
export interface DragState {
  origin: Note;
  before: EditorSnapshot;
  wasDirty: boolean;
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
  drag: DragState | null;
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
  | { type: 'changeSelectedPitch'; pitch: Pitch; baseOctave: 4 | 5 }
  | { type: 'nudgeSelected'; steps: number }
  | { type: 'dragSelected'; steps: number }
  | { type: 'endDrag' }
  | { type: 'restSelected' }
  | { type: 'setDuration'; duration: Duration }
  | { type: 'toggleDotted' }
  | { type: 'shiftOctave'; delta: 1 | -1 }
  | { type: 'setTitle'; title: string }
  | { type: 'setTimeSignature'; timeSignature: TimeSignature }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; song: Song }
  | { type: 'restore'; song: Song }
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
    drag: null,
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
    drag: null,
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

/** Backspace with a selection: same rule, then select the event before it (or put the cursor at the start). */
function deleteSelected(state: EditorState, target: number): EditorState {
  const previous = target > 0 ? target - 1 : null;
  const cursor = previous === null ? 0 : previous + 1;
  const removed = state.song.events.filter((_, i) => i !== target);
  if (splitIntoMeasures(removed, state.song.timeSignature).ok) {
    return accept(state, { ...state.song, events: removed }, cursor, previous);
  }
  const old = state.song.events[target];
  if (old.kind === 'rest') {
    return { ...state, cursor, selection: previous, error: null, errorMeasure: null };
  }
  const events = [...state.song.events];
  events[target] = rest(old.duration, old.dotted ?? false);
  return accept(state, { ...state.song, events }, cursor, previous);
}

function rangeMessage(pitch: Pitch, octave: number): string {
  return `That ${pitch} is too ${octave < 4 ? 'low' : 'high'} — Note Chomp notes go from the G below middle C up to high C (${RANGE_LABEL}).`;
}

function selectedEvent(state: EditorState): MusicEvent | undefined {
  return state.selection === null ? undefined : state.song.events[state.selection];
}

function withSelected(state: EditorState, event: MusicEvent): Song {
  const events = [...state.song.events];
  if (state.selection !== null) events[state.selection] = event;
  return { ...state.song, events };
}

function sameEvent(a: MusicEvent, b: MusicEvent): boolean {
  if (a.kind !== b.kind || a.duration !== b.duration || !!a.dotted !== !!b.dotted) return false;
  return a.kind === 'rest' || (b.kind === 'note' && a.pitch === b.pitch && a.octave === b.octave);
}

function withLength(event: MusicEvent, duration: Duration, dotted: boolean): MusicEvent {
  return event.kind === 'note'
    ? note(event.pitch, event.octave, duration, dotted)
    : rest(duration, dotted);
}

/** Give the selected event a new length; on success it also becomes the length for new notes. */
function changeSelectedLength(
  state: EditorState,
  target: MusicEvent,
  duration: Duration,
  dotted: boolean,
): EditorState {
  const changed = withLength(target, duration, dotted);
  if (sameEvent(changed, target)) return { ...state, duration, dotted, error: null };
  const freed = eventUnits(target) - eventUnits(changed);
  const filler = freed > 0 ? fillUnits(freed, { duration, dotted }) : undefined;
  if (filler && state.selection !== null) {
    // Shortening: repeat the event at its new length so nothing after it moves.
    const events = [...state.song.events];
    const fill = filler.map((l) => withLength(target, l.duration, l.dotted));
    events.splice(state.selection, 1, changed, ...fill);
    const song = { ...state.song, events };
    return { ...accept(state, song, state.selection + 1, state.selection), duration, dotted };
  }
  const song = withSelected(state, changed);
  const check = splitIntoMeasures(song.events, song.timeSignature);
  if (!check.ok) {
    const lead = `Making it ${durationNameWithArticle(changed)}`;
    const message =
      state.selection !== null && check.error.eventIndex > state.selection
        ? pushedOutMessage(lead, check.error, song.events)
        : check.error.message;
    return reject(state, message, check.error.measureNumber);
  }
  return { ...accept(state, song, state.cursor, state.selection), duration, dotted };
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
      return state.selection === null
        ? deleteBackward(state)
        : deleteSelected(state, state.selection);
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
    case 'changeSelectedPitch': {
      const target = selectedEvent(state);
      if (!target) return state;
      const octave = action.baseOctave + state.octaveShift;
      if (!isInRange(action.pitch, octave))
        return reject(state, rangeMessage(action.pitch, octave));
      const changed = note(action.pitch, octave as Octave, target.duration, target.dotted ?? false);
      if (sameEvent(changed, target)) return { ...state, error: null, errorMeasure: null };
      return accept(state, withSelected(state, changed), state.cursor, state.selection);
    }
    case 'nudgeSelected': {
      const target = selectedEvent(state);
      if (!target || target.kind !== 'note') return state;
      const moved = stepPitch(target.pitch, target.octave, action.steps);
      if (!moved) return state;
      const changed = note(moved.pitch, moved.octave, target.duration, target.dotted ?? false);
      return accept(state, withSelected(state, changed), state.cursor, state.selection);
    }
    case 'dragSelected': {
      // Every step is measured from where the drag started; history waits for endDrag.
      const target = selectedEvent(state);
      if (!target || target.kind !== 'note') return state;
      const drag = state.drag ?? { origin: target, before: snapshot(state), wasDirty: state.dirty };
      const { origin } = drag;
      const moved = clampedStepPitch(origin.pitch, origin.octave, action.steps);
      const changed = note(moved.pitch, moved.octave, origin.duration, origin.dotted ?? false);
      return {
        ...state,
        song: withSelected(state, changed),
        drag,
        error: null,
        errorMeasure: null,
        dirty: drag.wasDirty || !sameEvent(changed, origin),
      };
    }
    case 'endDrag': {
      if (!state.drag) return state;
      const { origin, before, wasDirty } = state.drag;
      const current = selectedEvent(state);
      if (!current || sameEvent(current, origin)) {
        return { ...state, song: before.song, dirty: wasDirty, drag: null };
      }
      return {
        ...state,
        past: [...state.past, before].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
        drag: null,
      };
    }
    case 'restSelected': {
      const target = selectedEvent(state);
      if (!target || target.kind !== 'note') return state;
      const changed = rest(target.duration, target.dotted ?? false);
      return accept(state, withSelected(state, changed), state.cursor, state.selection);
    }
    case 'setDuration': {
      // dotted eighths are not offered
      const target = selectedEvent(state);
      if (!target) {
        return {
          ...state,
          duration: action.duration,
          dotted: action.duration === 'e' ? false : state.dotted,
        };
      }
      const dotted = action.duration === 'e' ? false : (target.dotted ?? false);
      return changeSelectedLength(state, target, action.duration, dotted);
    }
    case 'toggleDotted': {
      const target = selectedEvent(state);
      if (!target) {
        if (state.duration === 'e') return state;
        return { ...state, dotted: !state.dotted };
      }
      if (target.duration === 'e') return state;
      return changeSelectedLength(state, target, target.duration, !target.dotted);
    }
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
        drag: null,
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
        drag: null,
      };
    }
    case 'load':
      return createEditorState(action.song);
    case 'restore':
      return { ...createEditorState(action.song), dirty: true };
    case 'markSaved':
      return { ...state, dirty: false };
    case 'dismissError':
      return { ...state, error: null, errorMeasure: null };
  }
}
