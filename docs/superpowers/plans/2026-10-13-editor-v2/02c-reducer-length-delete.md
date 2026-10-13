# Phase 2c — Reducer: length, dot, delete, rest & restore (Task 7)

This task edits `src/core/editor/editorReducer.ts` as left by Task 6. Apply the edits in order; each "replace" anchor appears exactly once in the file.

### Task 7: Reducer: length, dot, delete & rest with a selection; restore

**Files:**
- Modify: `src/core/editor/editorReducer.ts`
- Test: `src/core/editor/editorSelectionEdits.test.ts` (new)

**Interfaces:**
- Consumes: Task 6 helpers `selectedEvent`, `withSelected`, `sameEvent`; Task 5 `accept`, `reject`, `pushedOutMessage`.
- Produces (used by Tasks 14, 17, 20):
  - `setDuration` / `toggleDotted` with a selection change the selected event's length (bar-crossing → friendly error with `errorMeasure`, no change) and, on success, make it the default for new notes. Without a selection: v1 behaviour. A selected eighth is never dotted; choosing eighth drops the dot.
  - `deleteBackward` with a selection deletes the selected event (v1 rule: leave a rest of the same length if removal breaks the bar lines; an unremovable rest is just stepped over) and selects the previous event, or puts the cursor at gap 0 when there is none.
  - New action `{ type: 'restSelected' }` — selected note → rest of the same length (no-op on rests / without selection).
  - New action `{ type: 'restore'; song: Song }` — like `load` but `dirty: true` (an unsaved draft brought back).

- [ ] **Step 1: Write the failing test**

**Create `src/core/editor/editorSelectionEdits.test.ts`:**

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

describe('length changes with a selection', () => {
  it('changes the selected event and makes it the length for new notes', () => {
    const start = withEvents([note('C', 4, 'q'), note('D', 4, 'q')]);
    const s = run(start, { type: 'select', index: 1 }, { type: 'setDuration', duration: 'h' });
    expect(s.song.events[1]).toEqual(note('D', 4, 'h'));
    expect(s).toMatchObject({ duration: 'h', dotted: false, selection: 1 });
    expect(s.past).toHaveLength(1);
  });

  it('refuses a length that breaks the bar lines, changing nothing', () => {
    const start = withEvents([note('C', 4, 'q'), note('D', 4, 'q'), note('E', 4, 'h')]);
    const s = run(start, { type: 'select', index: 0 }, { type: 'setDuration', duration: 'h' });
    expect(s.song.events).toEqual(start.song.events);
    expect(s.duration).toBe('q');
    expect(s.error).toBe(
      'Making it a half note pushes the notes after it out of line — in measure 1 a half note no longer fits. Try a shorter note, or delete a note first.',
    );
    expect(s.errorMeasure).toBe(1);
  });

  it('reports a selected note that no longer fits its own measure', () => {
    const start = withEvents([note('C', 4, 'h', true), note('D', 4, 'q')]);
    const s = run(start, { type: 'select', index: 1 }, { type: 'setDuration', duration: 'h' });
    expect(s.error).toMatch(/^Measure 1: the half note doesn't fit/);
  });

  it('drops the dot when the selected event becomes an eighth', () => {
    const start = withEvents([note('C', 4, 'q', true), note('D', 4, 'e')]);
    const s = run(start, { type: 'select', index: 0 }, { type: 'setDuration', duration: 'e' });
    expect(s.song.events[0]).toEqual(note('C', 4, 'e'));
    expect(s.dotted).toBe(false);
  });

  it('toggles the dot on the selected event', () => {
    const start = withEvents([note('C', 4, 'q'), rest('e')]);
    const s = run(start, { type: 'select', index: 0 }, { type: 'toggleDotted' });
    expect(s.song.events[0]).toEqual(note('C', 4, 'q', true));
    expect(s.dotted).toBe(true);
    const off = run(s, { type: 'toggleDotted' });
    expect(off.song.events[0]).toEqual(note('C', 4, 'q'));
  });

  it('never dots a selected eighth', () => {
    const start = run(withEvents([note('C', 4, 'e')]), { type: 'select', index: 0 });
    expect(run(start, { type: 'toggleDotted' })).toBe(start);
  });

  it('keeps v1 behaviour without a selection', () => {
    const s = run(withEvents([]), { type: 'setDuration', duration: 'w' }, { type: 'toggleDotted' });
    expect(s).toMatchObject({ duration: 'w', dotted: true });
    expect(s.past).toEqual([]);
  });
});

describe('deleting with a selection', () => {
  it('deletes the selected event and selects the one before it', () => {
    const start = withEvents([note('C', 4, 'q'), note('D', 4, 'q'), note('E', 4, 'q')]);
    const s = run(start, { type: 'select', index: 2 }, { type: 'deleteBackward' });
    expect(s.song.events).toEqual([note('C', 4, 'q'), note('D', 4, 'q')]);
    expect(s).toMatchObject({ selection: 1, cursor: 2 });
  });

  it('puts the cursor at the start after deleting the first event', () => {
    const start = withEvents([note('C', 4, 'q'), note('D', 4, 'q')]);
    const s = run(start, { type: 'select', index: 0 }, { type: 'deleteBackward' });
    expect(s.song.events).toEqual([note('D', 4, 'q')]);
    expect(s).toMatchObject({ selection: null, cursor: 0 });
  });

  it('leaves a rest when removing the note would break the bar lines', () => {
    const start = withEvents([note('C', 4, 'q'), note('D', 4, 'h', true), note('E', 4, 'w')]);
    const s = run(start, { type: 'select', index: 0 }, { type: 'deleteBackward' });
    expect(s.song.events).toEqual([rest('q'), note('D', 4, 'h', true), note('E', 4, 'w')]);
    expect(s).toMatchObject({ selection: null, cursor: 0 });
  });

  it('just moves the selection back over a rest that cannot be removed', () => {
    const start = withEvents([note('C', 4, 'q'), rest('q'), note('D', 4, 'h'), note('E', 4, 'w')]);
    const s = run(start, { type: 'select', index: 1 }, { type: 'deleteBackward' });
    expect(s.song.events).toEqual(start.song.events);
    expect(s).toMatchObject({ selection: 0, cursor: 1 });
    expect(s.past).toEqual([]);
  });
});

describe('restSelected and restore', () => {
  it('turns the selected note into a rest of the same length', () => {
    const start = withEvents([note('C', 4, 'h', true), note('D', 4, 'q')]);
    const s = run(start, { type: 'select', index: 0 }, { type: 'restSelected' });
    expect(s.song.events[0]).toEqual(rest('h', true));
    expect(s.selection).toBe(0);
    expect(run(s, { type: 'restSelected' })).toBe(s);
  });

  it('restore loads a draft as unsaved work with fresh history', () => {
    const draft = { ...createEmptySong('Draft'), events: [note('G', 4, 'q')] };
    const s = run(withEvents([note('C', 4, 'q')]), { type: 'restore', song: draft });
    expect(s).toMatchObject({ song: draft, cursor: 1, selection: null, dirty: true });
    expect(s.past).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/editor/editorSelectionEdits.test.ts`
Expected: FAIL — e.g. `expected { kind: 'note', … duration: 'q' } to deeply equal { … duration: 'h' }` (length changes still only set the default) and `Cannot read properties of undefined` for `restSelected`/`restore`.

- [ ] **Step 3: Implement — action types**

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
  | { type: 'endDrag' }
```

with:

```ts
  | { type: 'endDrag' }
  | { type: 'restSelected' }
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
  | { type: 'load'; song: Song }
```

with:

```ts
  | { type: 'load'; song: Song }
  | { type: 'restore'; song: Song }
```

- [ ] **Step 4: Implement — helpers**

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
function rangeMessage(pitch: Pitch, octave: number): string {
```

with:

```ts
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
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
function select(state: EditorState, index: number): EditorState {
```

with:

```ts
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
```

- [ ] **Step 5: Implement — the reducer cases**

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
    case 'deleteBackward':
      return deleteBackward(state);
```

with:

```ts
    case 'deleteBackward':
      return state.selection === null
        ? deleteBackward(state)
        : deleteSelected(state, state.selection);
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
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
```

with:

```ts
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
```

**Edit `src/core/editor/editorReducer.ts`** — replace:

```ts
    case 'load':
      return createEditorState(action.song);
```

with:

```ts
    case 'load':
      return createEditorState(action.song);
    case 'restore':
      return { ...createEditorState(action.song), dirty: true };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/editor`
Expected: PASS (all four editor test files, including v1 `editorReducer.test.ts`).

- [ ] **Step 7: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/core/editor/editorReducer.ts src/core/editor/editorSelectionEdits.test.ts
git commit -m "feat(editor): length, dot, delete and rest for the selected note; draft restore action"
```
