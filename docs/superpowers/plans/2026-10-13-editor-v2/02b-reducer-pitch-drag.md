# Phase 2b — Reducer: change, nudge & drag (Task 6)

This task edits `src/core/editor/editorReducer.ts` as left by Task 5. Apply the edits in order; each "replace" anchor appears exactly once in the file.

### Task 6: Reducer: change, nudge & drag the selected note

**Files:**
- Modify: `src/core/editor/editorReducer.ts`
- Test: `src/core/editor/editorSelectionPitch.test.ts` (new)

**Interfaces:**
- Consumes: Task 5 reducer (`snapshot`, `reject`, `accept(state, song, cursor, selection)`, `select`, `rangeMessage`); `stepPitch`, `clampedStepPitch` (Task 1).
- Produces (used by Tasks 14–17):
  - `interface DragState { origin: Note; before: EditorSnapshot; wasDirty: boolean }`; `EditorState.drag: DragState | null` (always null outside a pointer drag).
  - Actions:
    - `{ type: 'changeSelectedPitch'; pitch: Pitch; baseOctave: 4 | 5 }` — selected event becomes `pitch` at `baseOctave + octaveShift`, keeping duration/dot; a selected rest becomes a note; out of range → friendly range error, no change; same pitch → no history entry.
    - `{ type: 'nudgeSelected'; steps: number }` — diatonic steps via `stepPitch`; at G3/C6 nothing happens (no error); rests ignored.
    - `{ type: 'dragSelected'; steps: number }` — pitch = drag-origin pitch + steps (clamped), **no** history entry; starts a `DragState` on the first call.
    - `{ type: 'endDrag' }` — one history entry for the whole drag if the pitch changed; otherwise restores the original song object and dirty flag.
  - Internal helpers (Task 7 reuses them): `selectedEvent(state)`, `withSelected(state, event): Song`, `sameEvent(a, b)`.

- [ ] **Step 1: Write the failing test**

**Create `src/core/editor/editorSelectionPitch.test.ts`:**

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
/** C D E F as quarters in 4/4 — one full measure. */
const cdef = () =>
  withEvents([note('C', 4, 'q'), note('D', 4, 'q'), note('E', 4, 'q'), note('F', 4, 'q')]);

describe('changing the selected note', () => {
  it('replaces the pitch at the base octave plus the octave shift, keeping the length', () => {
    const start = withEvents([note('C', 4, 'h', true), rest('q')]);
    const s = run(
      start,
      { type: 'select', index: 0 },
      { type: 'shiftOctave', delta: 1 },
      { type: 'changeSelectedPitch', pitch: 'G', baseOctave: 4 },
    );
    expect(s.song.events[0]).toEqual(note('G', 5, 'h', true));
    expect(s).toMatchObject({ selection: 0, dirty: true });
    expect(s.past).toHaveLength(1);
  });

  it('turns a selected rest into a note of the same length', () => {
    const start = withEvents([note('C', 4, 'h'), rest('h')]);
    const s = run(
      start,
      { type: 'select', index: 1 },
      { type: 'changeSelectedPitch', pitch: 'E', baseOctave: 4 },
    );
    expect(s.song.events[1]).toEqual(note('E', 4, 'h'));
  });

  it('refuses notes off the staff with the friendly message and changes nothing', () => {
    const s = run(
      cdef(),
      { type: 'select', index: 0 },
      { type: 'shiftOctave', delta: -1 },
      { type: 'changeSelectedPitch', pitch: 'C', baseOctave: 4 },
    );
    expect(s.error).toContain('too low');
    expect(s.song.events[0]).toEqual(note('C', 4, 'q'));
  });

  it('does not add history when the pitch is the same', () => {
    const s = run(
      cdef(),
      { type: 'select', index: 0 },
      { type: 'changeSelectedPitch', pitch: 'C', baseOctave: 4 },
    );
    expect(s.past).toEqual([]);
  });
});

describe('nudging the selected note', () => {
  it('moves one line or space per step', () => {
    const s = run(cdef(), { type: 'select', index: 2 }, { type: 'nudgeSelected', steps: 1 });
    expect(s.song.events[2]).toEqual(note('F', 4, 'q'));
    const down = run(s, { type: 'nudgeSelected', steps: -2 });
    expect(down.song.events[2]).toEqual(note('D', 4, 'q'));
    expect(down.past).toHaveLength(2);
  });

  it('stops at G3 and C6 without an error', () => {
    const top = withEvents([note('C', 6, 'w')]);
    const s = run(top, { type: 'select', index: 0 }, { type: 'nudgeSelected', steps: 1 });
    expect(s.song.events[0]).toEqual(note('C', 6, 'w'));
    expect(s.error).toBeNull();
    expect(s.past).toEqual([]);
    const bottom = run(
      withEvents([note('G', 3, 'w')]),
      { type: 'select', index: 0 },
      { type: 'nudgeSelected', steps: -1 },
    );
    expect(bottom.song.events[0]).toEqual(note('G', 3, 'w'));
  });

  it('ignores rests and an empty selection', () => {
    const s = run(
      withEvents([rest('w')]),
      { type: 'select', index: 0 },
      { type: 'nudgeSelected', steps: 1 },
    );
    expect(s.song.events[0]).toEqual(rest('w'));
    const plain = cdef();
    expect(run(plain, { type: 'nudgeSelected', steps: 1 })).toBe(plain);
  });
});

describe('dragging the selected note', () => {
  it('follows the pointer from where the drag started, then commits one undo step', () => {
    const start = run(cdef(), { type: 'select', index: 2 });
    const mid = run(
      start,
      { type: 'dragSelected', steps: 1 },
      { type: 'dragSelected', steps: 3 },
      { type: 'dragSelected', steps: 2 },
    );
    expect(mid.song.events[2]).toEqual(note('G', 4, 'q'));
    expect(mid.past).toEqual([]);
    expect(mid.dirty).toBe(true);

    const done = run(mid, { type: 'endDrag' });
    expect(done.drag).toBeNull();
    expect(done.past).toHaveLength(1);
    expect(run(done, { type: 'undo' }).song.events[2]).toEqual(note('E', 4, 'q'));
  });

  it('clamps to the range while dragging', () => {
    const s = run(cdef(), { type: 'select', index: 3 }, { type: 'dragSelected', steps: 40 });
    expect(s.song.events[3]).toEqual(note('C', 6, 'q'));
  });

  it('adds no history when the drag ends where it began', () => {
    const start = run(cdef(), { type: 'select', index: 0 });
    const s = run(
      start,
      { type: 'dragSelected', steps: 2 },
      { type: 'dragSelected', steps: 0 },
      { type: 'endDrag' },
    );
    expect(s.past).toEqual([]);
    expect(s.dirty).toBe(false);
    expect(s.song).toBe(start.song);
  });

  it('does nothing for rests or without a drag', () => {
    const r = run(
      withEvents([rest('w')]),
      { type: 'select', index: 0 },
      { type: 'dragSelected', steps: 2 },
    );
    expect(r.drag).toBeNull();
    const plain = cdef();
    expect(run(plain, { type: 'endDrag' })).toBe(plain);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/editor/editorSelectionPitch.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'song')` (the reducer returns `undefined` for the unknown action types).

- [ ] **Step 3: Implement — imports and types**

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
import type { Duration, MusicEvent, Octave, Pitch, Song, TimeSignature } from '../model/types';
import { isInRange, RANGE_LABEL } from '../theory/pitch';
```

with:

```ts
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
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
export interface EditorState extends EditorSnapshot {
```

with:

```ts
/** A pointer drag in progress: where the note started and the state to undo back to. */
export interface DragState {
  origin: Note;
  before: EditorSnapshot;
  wasDirty: boolean;
}

export interface EditorState extends EditorSnapshot {
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
  errorMeasure: number | null;
  dirty: boolean;
}
```

with:

```ts
  errorMeasure: number | null;
  dirty: boolean;
  drag: DragState | null;
}
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
  | { type: 'navigate'; delta: number }
```

with:

```ts
  | { type: 'navigate'; delta: number }
  | { type: 'changeSelectedPitch'; pitch: Pitch; baseOctave: 4 | 5 }
  | { type: 'nudgeSelected'; steps: number }
  | { type: 'dragSelected'; steps: number }
  | { type: 'endDrag' }
```

- [ ] **Step 4: Implement — `drag: null` wherever state is rebuilt**

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
    errorMeasure: null,
    dirty: false,
  };
}
```

with:

```ts
    errorMeasure: null,
    dirty: false,
    drag: null,
  };
}
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
    future: [],
    error: null,
    errorMeasure: null,
    dirty: true,
  };
}
```

with:

```ts
    future: [],
    error: null,
    errorMeasure: null,
    dirty: true,
    drag: null,
  };
}
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
        future: [snapshot(state), ...state.future],
        error: null,
        errorMeasure: null,
        dirty: true,
      };
```

with:

```ts
        future: [snapshot(state), ...state.future],
        error: null,
        errorMeasure: null,
        dirty: true,
        drag: null,
      };
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
        future: state.future.slice(1),
        error: null,
        errorMeasure: null,
        dirty: true,
      };
```

with:

```ts
        future: state.future.slice(1),
        error: null,
        errorMeasure: null,
        dirty: true,
        drag: null,
      };
```

- [ ] **Step 5: Implement — helpers and the four actions**

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
function select(state: EditorState, index: number): EditorState {
```

with:

```ts
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

function select(state: EditorState, index: number): EditorState {
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
      return { ...state, selection: null, cursor: next / 2, error: null, errorMeasure: null };
    }
```

with:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/editor`
Expected: PASS (all editor test files).

- [ ] **Step 7: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/core/editor/editorReducer.ts src/core/editor/editorSelectionPitch.test.ts
git commit -m "feat(editor): change, nudge and drag the selected note"
```

