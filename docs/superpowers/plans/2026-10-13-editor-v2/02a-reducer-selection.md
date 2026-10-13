# Phase 2a — Reducer: selection & navigation (Task 5)

### Task 5: Reducer: selection & navigation

**Files:**
- Modify (full replacement): `src/core/editor/editorReducer.ts`
- Test: `src/core/editor/editorSelection.test.ts` (new); existing `src/core/editor/editorReducer.test.ts` must stay green unchanged.

**Interfaces:**
- Consumes: v1 reducer (read it first: `insert`, `deleteBackward`, `commit`/`accept`, history with `HISTORY_LIMIT`); `splitIntoMeasures` and its `MeasureError { eventIndex; measureNumber; message }` from `src/core/theory/rhythm.ts`.
- Produces (used by Tasks 6, 7, 13–20):
  - `EditorSnapshot { song: Song; cursor: number; selection: number | null }`
  - `EditorState` adds `selection: number | null` and `errorMeasure: number | null` (the measure a rejection is about; null when unknown).
  - New actions: `{ type: 'select'; index: number }`, `{ type: 'clearSelection' }`, `{ type: 'navigate'; delta: number }`.
  - Behaviour: `select` clamps to an existing event, sets `cursor = index + 1`, clears the error (no-op on an empty song). `clearSelection` drops the selection and leaves the cursor right after it. `setCursor` and `moveCursor` drop the selection. `navigate` walks gap 0, note 0, gap 1, …, gap N (clamped). Every successful edit (`accept`) stores the previous `{ song, cursor, selection }` and, unless told otherwise, clears the selection; undo/redo restore `selection`. Insert/time-signature rejections record `errorMeasure`; `dismissError` clears both.
  - Internal helpers later tasks extend: `snapshot(state)`, `reject(state, message, measure?)`, `accept(state, song, cursor, selection = null)`, `pushedOutMessage(lead, error, events)`, `select(state, index)`, `rangeMessage(pitch, octave)`.

- [ ] **Step 1: Write the failing test**

**Create `src/core/editor/editorSelection.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from '../model/factories';
import type { MusicEvent } from '../model/types';
import {
  createEditorState,
  editorReducer,
  type EditorAction,
  type EditorState,
} from './editorReducer';

const run = (state: EditorState, ...actions: EditorAction[]) =>
  actions.reduce(editorReducer, state);
const withEvents = (events: MusicEvent[]) =>
  createEditorState({ ...createEmptySong('Test'), id: 'id-1', events });
/** C E G(half): inserting a quarter before E pushes the half note out of measure 1. */
const ceg = () => withEvents([note('C', 4, 'q'), note('E', 4, 'q'), note('G', 4, 'h')]);
/** C D E F as quarters in 4/4 — one full measure. */
const cdef = () =>
  withEvents([note('C', 4, 'q'), note('D', 4, 'q'), note('E', 4, 'q'), note('F', 4, 'q')]);

describe('selection', () => {
  it('starts with nothing selected', () => {
    expect(cdef().selection).toBeNull();
  });

  it('selects a clamped event and parks the cursor after it', () => {
    expect(run(cdef(), { type: 'select', index: 1 })).toMatchObject({ selection: 1, cursor: 2 });
    expect(run(cdef(), { type: 'select', index: 9 }).selection).toBe(3);
    expect(run(cdef(), { type: 'select', index: -2 }).selection).toBe(0);
    expect(run(withEvents([]), { type: 'select', index: 0 }).selection).toBeNull();
  });

  it('clears the error when selecting', () => {
    const failed = run(
      ceg(),
      { type: 'setCursor', index: 1 },
      { type: 'insertNote', pitch: 'D', baseOctave: 4 },
    );
    expect(failed.error).not.toBeNull();
    expect(run(failed, { type: 'select', index: 0 }).error).toBeNull();
  });

  it('clearSelection puts the cursor right after the selected event', () => {
    const s = run(cdef(), { type: 'select', index: 1 }, { type: 'clearSelection' });
    expect(s).toMatchObject({ selection: null, cursor: 2 });
  });

  it('setCursor places the cursor in a gap and drops the selection', () => {
    const s = run(cdef(), { type: 'select', index: 3 }, { type: 'setCursor', index: 1 });
    expect(s).toMatchObject({ selection: null, cursor: 1 });
  });

  it('navigate walks gap, note, gap, note … and is clamped at both ends', () => {
    let s = run(cdef(), { type: 'setCursor', index: 0 });
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      s = run(s, { type: 'navigate', delta: 1 });
      seen.push(s.selection === null ? `gap${s.cursor}` : `note${s.selection}`);
    }
    expect(seen).toEqual([
      'note0',
      'gap1',
      'note1',
      'gap2',
      'note2',
      'gap3',
      'note3',
      'gap4',
      'gap4',
      'gap4',
    ]);
    const back = run(s, { type: 'navigate', delta: -1 });
    expect(back.selection).toBe(3);
    expect(run(withEvents([]), { type: 'navigate', delta: -1 })).toMatchObject({
      cursor: 0,
      selection: null,
    });
  });

  it('inserting a note drops the selection and adds after the selected note', () => {
    const s = run(
      cdef(),
      { type: 'setTimeSignature', timeSignature: '4/4' },
      { type: 'select', index: 3 },
      { type: 'insertNote', pitch: 'G', baseOctave: 4 },
    );
    expect(s.selection).toBeNull();
    expect(s.song.events[4]).toEqual(note('G', 4, 'q'));
    expect(s.cursor).toBe(5);
  });

  it('undo and redo restore the selection too', () => {
    const s = run(cdef(), { type: 'select', index: 1 }, { type: 'insertRest' });
    expect(s).toMatchObject({ selection: null, cursor: 3 });
    const undone = run(s, { type: 'undo' });
    expect(undone).toMatchObject({ selection: 1, cursor: 2 });
    expect(undone.song.events).toHaveLength(4);
    const redone = run(undone, { type: 'select', index: 3 }, { type: 'redo' });
    expect(redone.song.events[2]).toEqual(rest('q'));
    expect(redone).toMatchObject({ selection: null, cursor: 3 });
  });

  it('remembers the measure an error is about, and forgets it on dismiss', () => {
    const s = run(
      ceg(),
      { type: 'setCursor', index: 1 },
      { type: 'insertNote', pitch: 'D', baseOctave: 4 },
    );
    expect(s.error).toContain('pushes the notes after it out of line');
    expect(s.errorMeasure).toBe(1);
    expect(run(s, { type: 'dismissError' })).toMatchObject({ error: null, errorMeasure: null });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/editor/editorSelection.test.ts`
Expected: FAIL — e.g. `expected undefined to be null` for `selection`, and TypeScript-unknown action types return `undefined` state (`Cannot read properties of undefined`).

- [ ] **Step 3: Implement**

**Replace `src/core/editor/editorReducer.ts` with:**

```ts
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
```

Notes for the implementer: the insert error text is unchanged from v1 (now built by `pushedOutMessage`), so the v1 test `explains when an insert in the middle pushes later notes out of their measure` still passes. `EditorPage.tsx` keeps compiling: every v1 action still exists.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/editor`
Expected: PASS — the new selection tests and all v1 `editorReducer.test.ts` tests.

- [ ] **Step 5: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/core/editor/editorReducer.ts src/core/editor/editorSelection.test.ts
git commit -m "feat(editor): selection, gap/note navigation and error measures in the reducer"
```
