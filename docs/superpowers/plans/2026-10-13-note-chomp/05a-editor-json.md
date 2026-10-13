# Phase 5a — Editor reducer and import plumbing

### Task 15: Editor reducer

**Files:**
- Create: `src/core/editor/editorReducer.ts`
- Test: `src/core/editor/editorReducer.test.ts`

**Interfaces:**
- Consumes: factories, types (Task 2), `isInRange`, `RANGE_LABEL` (Task 3), `splitIntoMeasures`, `durationNameWithArticle` (Task 4)
- Produces:
  - `HISTORY_LIMIT = 100`
  - `type OctaveShift = -1 | 0 | 1`
  - `interface EditorSnapshot { song: Song; cursor: number }`
  - `interface EditorState extends EditorSnapshot { duration: Duration; dotted: boolean; octaveShift: OctaveShift; past: EditorSnapshot[]; future: EditorSnapshot[]; error: string | null; dirty: boolean }`
  - `type EditorAction` (union below)
  - `createEditorState(song?: Song): EditorState` — cursor at end, quarter notes, no dot, shift 0
  - `editorReducer(state: EditorState, action: EditorAction): EditorState`

Behavior: inserts happen **at the cursor** and advance it. An insert or time-signature change that would make a note cross a bar line is rejected: the song is unchanged and `error` holds a friendly message — the one from `splitIntoMeasures`, except when an insert in the middle pushes a *later* note out of its measure, which gets: `Adding a quarter note here pushes the notes after it out of line — in measure 2 a half note no longer fits. Try a shorter note, or delete a note first.` Backspace never gets stuck: if removing the event before the cursor would break the bar lines, that event is replaced by a rest of the same length instead (bar lines stay put, no error) and the cursor still moves back. Dotted eighths are not offered: choosing eighths clears the dot and the dot toggle does nothing while eighths are selected. A note outside the range gets `That C is too low — Note Chomp notes go from the G below middle C up to high C (G3–C6).` Title edits do not enter undo history, and undo/redo keep the current title. The fruit buttons send `baseOctave` 4 (C4–B4) or 5 (high C); the final octave is `baseOctave + octaveShift`.

- [ ] **Step 1: Write the failing test**

`src/core/editor/editorReducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from '../model/factories';
import { createEditorState, editorReducer, HISTORY_LIMIT, type EditorAction, type EditorState } from './editorReducer';

const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);
const fresh = () => createEditorState({ ...createEmptySong('Test'), id: 'id-1' });

describe('editorReducer', () => {
  it('starts with the cursor at the end, quarter notes, no shift', () => {
    const song = { ...createEmptySong('X'), events: [note('C', 4, 'q')] };
    expect(createEditorState(song)).toMatchObject({ cursor: 1, duration: 'q', dotted: false, octaveShift: 0, dirty: false });
  });

  it('inserts notes at the cursor with the selected duration', () => {
    const s = run(fresh(), { type: 'setDuration', duration: 'h' }, { type: 'insertNote', pitch: 'E', baseOctave: 4 });
    expect(s.song.events).toEqual([note('E', 4, 'h')]);
    expect(s.cursor).toBe(1);
    expect(s.dirty).toBe(true);
  });

  it('inserts in the middle when the cursor is moved', () => {
    const s = run(
      fresh(),
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'insertNote', pitch: 'E', baseOctave: 4 },
      { type: 'setCursor', index: 1 },
      { type: 'insertNote', pitch: 'D', baseOctave: 4 },
    );
    expect(s.song.events.map((e) => (e.kind === 'note' ? e.pitch : 'r'))).toEqual(['C', 'D', 'E']);
    expect(s.cursor).toBe(2);
  });

  it('applies dots and rests', () => {
    const s = run(fresh(), { type: 'toggleDotted' }, { type: 'insertRest' });
    expect(s.song.events).toEqual([rest('q', true)]);
  });

  it('shifts octaves within G3–C6 and reports notes off the staff', () => {
    const low = run(fresh(), { type: 'shiftOctave', delta: -1 }, { type: 'insertNote', pitch: 'G', baseOctave: 4 });
    expect(low.song.events).toEqual([note('G', 3, 'q')]);

    const tooLow = run(fresh(), { type: 'shiftOctave', delta: -1 }, { type: 'insertNote', pitch: 'C', baseOctave: 4 });
    expect(tooLow.song.events).toEqual([]);
    expect(tooLow.error).toBe(
      'That C is too low — Note Chomp notes go from the G below middle C up to high C (G3–C6).',
    );

    const high = run(fresh(), { type: 'shiftOctave', delta: 1 }, { type: 'insertNote', pitch: 'C', baseOctave: 5 });
    expect(high.song.events).toEqual([note('C', 6, 'q')]);

    const tooHigh = run(fresh(), { type: 'shiftOctave', delta: 1 }, { type: 'insertNote', pitch: 'D', baseOctave: 5 });
    expect(tooHigh.song.events).toEqual([]);
    expect(tooHigh.error).toBe(
      'That D is too high — Note Chomp notes go from the G below middle C up to high C (G3–C6).',
    );
  });

  it('does not offer dotted eighths', () => {
    const cleared = run(fresh(), { type: 'toggleDotted' }, { type: 'setDuration', duration: 'e' });
    expect(cleared.dotted).toBe(false);
    expect(run(cleared, { type: 'toggleDotted' }).dotted).toBe(false);
    const s = run(cleared, { type: 'toggleDotted' }, { type: 'insertNote', pitch: 'C', baseOctave: 4 });
    expect(s.song.events).toEqual([note('C', 4, 'e')]);
    expect(run(cleared, { type: 'setDuration', duration: 'q' }, { type: 'toggleDotted' }).dotted).toBe(true);
  });

  it('clamps the octave shift to ±1', () => {
    const s = run(fresh(), { type: 'shiftOctave', delta: 1 }, { type: 'shiftOctave', delta: 1 });
    expect(s.octaveShift).toBe(1);
  });

  it('rejects an insert that would cross a bar line', () => {
    const s = run(
      fresh(),
      { type: 'setDuration', duration: 'h' }, { type: 'toggleDotted' },
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'toggleDotted' },
      { type: 'insertNote', pitch: 'D', baseOctave: 4 },
    );
    expect(s.song.events).toHaveLength(1);
    expect(s.error).toMatch(/^Measure 1: the half note doesn't fit/);
  });

  it('explains when an insert in the middle pushes later notes out of their measure', () => {
    const start = run(
      fresh(),
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'insertNote', pitch: 'E', baseOctave: 4 },
      { type: 'setDuration', duration: 'h' },
      { type: 'insertNote', pitch: 'G', baseOctave: 4 },
      { type: 'setDuration', duration: 'q' },
      { type: 'setCursor', index: 1 },
    );
    const s = run(start, { type: 'insertNote', pitch: 'D', baseOctave: 4 });
    expect(s.song.events).toEqual(start.song.events);
    expect(s.cursor).toBe(1);
    expect(s.error).toBe(
      'Adding a quarter note here pushes the notes after it out of line — in measure 1 a half note no longer fits. Try a shorter note, or delete a note first.',
    );
  });

  it('clears the error on the next successful edit or on dismiss', () => {
    const bad = run(fresh(), { type: 'shiftOctave', delta: -1 }, { type: 'insertNote', pitch: 'C', baseOctave: 4 });
    expect(run(bad, { type: 'dismissError' }).error).toBeNull();
    expect(run(bad, { type: 'insertNote', pitch: 'A', baseOctave: 4 }).error).toBeNull();
  });

  it('deletes the event before the cursor', () => {
    const s = run(
      fresh(),
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'insertNote', pitch: 'D', baseOctave: 4 },
      { type: 'deleteBackward' },
    );
    expect(s.song.events).toEqual([note('C', 4, 'q')]);
    expect(s.cursor).toBe(1);
    expect(run(fresh(), { type: 'deleteBackward' }).song.events).toEqual([]);
  });

  it('turns a note into a rest when deleting it would break the bar lines', () => {
    const song = {
      ...createEmptySong('Bars'),
      id: 'id-3',
      events: [note('C', 4, 'q'), note('D', 4, 'q'), note('E', 4, 'h'), note('F', 4, 'h'), note('G', 4, 'h')],
    };
    const s = run(createEditorState(song), { type: 'setCursor', index: 2 }, { type: 'deleteBackward' });
    expect(s.song.events).toEqual([note('C', 4, 'q'), rest('q'), note('E', 4, 'h'), note('F', 4, 'h'), note('G', 4, 'h')]);
    expect(s.cursor).toBe(1);
    expect(s.error).toBeNull();
    expect(s.past).toHaveLength(1);
    // keeps going backwards instead of getting stuck on the new rest
    const next = run(s, { type: 'deleteBackward' });
    expect(next.song.events).toEqual([rest('q'), rest('q'), note('E', 4, 'h'), note('F', 4, 'h'), note('G', 4, 'h')]);
    expect(next.cursor).toBe(0);
  });

  it('just steps back over a rest that cannot be removed', () => {
    const song = {
      ...createEmptySong('Rest'),
      id: 'id-4',
      events: [note('C', 4, 'q'), rest('q'), note('E', 4, 'h'), note('F', 4, 'h'), note('G', 4, 'h')],
    };
    const s = run(createEditorState(song), { type: 'setCursor', index: 2 }, { type: 'deleteBackward' });
    expect(s.song).toBe(song);
    expect(s.cursor).toBe(1);
    expect(s.past).toEqual([]);
  });

  it('clamps cursor movement', () => {
    const s = run(fresh(), { type: 'insertNote', pitch: 'C', baseOctave: 4 }, { type: 'moveCursor', delta: -5 });
    expect(s.cursor).toBe(0);
    expect(run(s, { type: 'moveCursor', delta: 9 }).cursor).toBe(1);
  });

  it('undoes and redoes edits but keeps the current title', () => {
    const s = run(
      fresh(),
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'insertNote', pitch: 'D', baseOctave: 4 },
      { type: 'setTitle', title: 'Renamed' },
      { type: 'undo' },
    );
    expect(s.song.events).toEqual([note('C', 4, 'q')]);
    expect(s.song.title).toBe('Renamed');
    const redone = run(s, { type: 'redo' });
    expect(redone.song.events).toHaveLength(2);
    expect(redone.song.title).toBe('Renamed');
  });

  it('a new edit clears the redo stack', () => {
    const s = run(
      fresh(),
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'undo' },
      { type: 'insertNote', pitch: 'E', baseOctave: 4 },
    );
    expect(s.future).toEqual([]);
    expect(run(s, { type: 'redo' })).toBe(s);
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    let s = fresh();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s = editorReducer(s, { type: 'insertNote', pitch: 'C', baseOctave: 4 });
    expect(s.past).toHaveLength(HISTORY_LIMIT);
  });

  it('rejects a time signature change that breaks bars', () => {
    const s = run(
      fresh(),
      { type: 'setDuration', duration: 'w' },
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'setTimeSignature', timeSignature: '3/4' },
    );
    expect(s.song.timeSignature).toBe('4/4');
    expect(s.error).toMatch(/longer than a whole measure of 3\/4/);
  });

  it('loads a song and resets history; markSaved clears dirty', () => {
    const loaded = run(fresh(), { type: 'insertNote', pitch: 'C', baseOctave: 4 }, {
      type: 'load', song: { ...createEmptySong('Other'), id: 'id-2' },
    });
    expect(loaded.song.id).toBe('id-2');
    expect(loaded.past).toEqual([]);
    expect(run(fresh(), { type: 'insertRest' }, { type: 'markSaved' }).dirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/editor`
Expected: FAIL — cannot resolve `./editorReducer`.

- [ ] **Step 3: Implement `src/core/editor/editorReducer.ts`**

```ts
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
      if (!isInRange(action.pitch, octave)) return { ...state, error: rangeMessage(action.pitch, octave) };
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
      return { ...state, duration: action.duration, dotted: action.duration === 'e' ? false : state.dotted };
    case 'toggleDotted':
      if (state.duration === 'e') return state;
      return { ...state, dotted: !state.dotted };
    case 'shiftOctave':
      return { ...state, octaveShift: clamp(state.octaveShift + action.delta, -1, 1) as OctaveShift };
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/editor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/editor && git commit -m "feat(core): undoable tap-editor reducer"
```

---

### Task 16: Import result types, issue collector, NoteChomp JSON format

**Files:**
- Create: `src/formats/types.ts`, `src/formats/issues.ts`, `src/formats/finalize.ts`, `src/formats/notechomp/notechomp.ts`
- Test: `src/formats/issues.test.ts`, `src/formats/notechomp/notechomp.test.ts`

**Interfaces:**
- Consumes: `validateSong` (Task 6), `Song` (Task 2)
- Produces:
  - `interface ImportIssue { message: string }`
  - `type ImportResult = { ok: true; song: Song; warnings: ImportIssue[] } | { ok: false; errors: ImportIssue[] }`
  - `importFailure(messages: string[]): ImportResult`
  - `class IssueCollector { warn(message: string): void; error(message: string): void; get hasErrors(): boolean; get warnings(): ImportIssue[]; get errors(): ImportIssue[] }` — de-duplicates identical messages
  - `finalizeImport(draft: unknown, issues: IssueCollector): ImportResult` — fails on collected errors, schema errors, or no note events (a rests-only file counts as empty)
  - `NOTECHOMP_EXTENSION = '.notechomp.json'`, `serializeSong(song: Song): string`, `parseNoteChompJson(text: string): ImportResult`

- [ ] **Step 1: Write the failing tests**

`src/formats/issues.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { finalizeImport } from './finalize';
import { IssueCollector } from './issues';

describe('IssueCollector', () => {
  it('de-duplicates messages and tracks errors', () => {
    const issues = new IssueCollector();
    issues.warn('Lyrics were ignored.');
    issues.warn('Lyrics were ignored.');
    expect(issues.warnings).toEqual([{ message: 'Lyrics were ignored.' }]);
    expect(issues.hasErrors).toBe(false);
    issues.error('Bad');
    expect(issues.hasErrors).toBe(true);
  });
});

describe('finalizeImport', () => {
  const draft = (events: unknown[]) => ({ schemaVersion: 1, id: 'x', title: 'T', timeSignature: '4/4', events });

  it('fails when errors were collected', () => {
    const issues = new IssueCollector();
    issues.error('Measure 1: chords aren\'t supported.');
    expect(finalizeImport(draft([]), issues)).toEqual({ ok: false, errors: [{ message: "Measure 1: chords aren't supported." }] });
  });

  it('fails when there are no notes', () => {
    expect(finalizeImport(draft([]), new IssueCollector())).toEqual({
      ok: false, errors: [{ message: 'No notes were found in this file.' }],
    });
  });

  it('treats a file with only rests as having no notes', () => {
    const restsOnly = draft([{ kind: 'rest', duration: 'w' }, { kind: 'rest', duration: 'h' }]);
    expect(finalizeImport(restsOnly, new IssueCollector())).toEqual({
      ok: false, errors: [{ message: 'No notes were found in this file.' }],
    });
  });

  it('returns the validated song and warnings', () => {
    const issues = new IssueCollector();
    issues.warn('Lyrics were ignored.');
    const result = finalizeImport(draft([{ kind: 'note', pitch: 'C', octave: 4, duration: 'q' }]), issues);
    expect(result).toMatchObject({ ok: true, warnings: [{ message: 'Lyrics were ignored.' }] });
  });
});
```

`src/formats/notechomp/notechomp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../../core/model/factories';
import { parseNoteChompJson, serializeSong } from './notechomp';

describe('NoteChomp JSON', () => {
  const song = { ...createEmptySong('Round Trip'), events: [note('G', 3, 'h', true), note('C', 6, 'q')] };

  it('round-trips a song', () => {
    const result = parseNoteChompJson(serializeSong(song));
    expect(result).toEqual({ ok: true, song, warnings: [] });
  });

  it('serializes as pretty JSON with a trailing newline', () => {
    const text = serializeSong(song);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "title": "Round Trip"');
  });

  it('reports invalid JSON', () => {
    expect(parseNoteChompJson('{oops')).toEqual({ ok: false, errors: [{ message: "This file isn't valid Note Chomp JSON." }] });
  });

  it('reports schema problems', () => {
    const result = parseNoteChompJson(JSON.stringify({ ...song, events: [note('F', 3, 'q')] }));
    expect(result).toEqual({
      ok: false,
      errors: [{ message: "Note 1: F3 is outside Note Chomp's range (the G below middle C up to high C, G3–C6)." }],
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/formats`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/formats/types.ts`:

```ts
import type { Song } from '../core/model/types';

export interface ImportIssue {
  message: string;
}

export type ImportResult =
  | { ok: true; song: Song; warnings: ImportIssue[] }
  | { ok: false; errors: ImportIssue[] };

export function importFailure(messages: string[]): ImportResult {
  return { ok: false, errors: messages.map((message) => ({ message })) };
}
```

`src/formats/issues.ts`:

```ts
import type { ImportIssue } from './types';

export class IssueCollector {
  private readonly warningSet = new Set<string>();
  private readonly errorSet = new Set<string>();

  warn(message: string): void {
    this.warningSet.add(message);
  }

  error(message: string): void {
    this.errorSet.add(message);
  }

  get hasErrors(): boolean {
    return this.errorSet.size > 0;
  }

  get warnings(): ImportIssue[] {
    return [...this.warningSet].map((message) => ({ message }));
  }

  get errors(): ImportIssue[] {
    return [...this.errorSet].map((message) => ({ message }));
  }
}
```

`src/formats/finalize.ts`:

```ts
import { validateSong } from '../core/model/schema';
import type { IssueCollector } from './issues';
import type { ImportResult } from './types';

export function finalizeImport(draft: unknown, issues: IssueCollector): ImportResult {
  if (issues.hasErrors) return { ok: false, errors: issues.errors };
  const validated = validateSong(draft);
  if (!validated.ok) {
    return { ok: false, errors: validated.error.map((issue) => ({ message: issue.message })) };
  }
  // A file with only rests is as empty as one with nothing in it.
  if (!validated.value.events.some((event) => event.kind === 'note')) {
    return { ok: false, errors: [{ message: 'No notes were found in this file.' }] };
  }
  return { ok: true, song: validated.value, warnings: issues.warnings };
}
```

`src/formats/notechomp/notechomp.ts`:

```ts
import type { Song } from '../../core/model/types';
import { finalizeImport } from '../finalize';
import { IssueCollector } from '../issues';
import { importFailure, type ImportResult } from '../types';

export const NOTECHOMP_EXTENSION = '.notechomp.json';

export function serializeSong(song: Song): string {
  return `${JSON.stringify(song, null, 2)}\n`;
}

export function parseNoteChompJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return importFailure(["This file isn't valid Note Chomp JSON."]);
  }
  return finalizeImport(data, new IssueCollector());
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/formats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats && git commit -m "feat(formats): import result types and NoteChomp JSON format"
```
