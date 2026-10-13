import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from '../model/factories';
import {
  createEditorState,
  editorReducer,
  HISTORY_LIMIT,
  type EditorAction,
  type EditorState,
} from './editorReducer';

const run = (state: EditorState, ...actions: EditorAction[]) =>
  actions.reduce(editorReducer, state);
const fresh = () => createEditorState({ ...createEmptySong('Test'), id: 'id-1' });

describe('editorReducer', () => {
  it('starts with the cursor at the end, quarter notes, no shift', () => {
    const song = { ...createEmptySong('X'), events: [note('C', 4, 'q')] };
    expect(createEditorState(song)).toMatchObject({
      cursor: 1,
      duration: 'q',
      dotted: false,
      octaveShift: 0,
      dirty: false,
    });
  });

  it('inserts notes at the cursor with the selected duration', () => {
    const s = run(
      fresh(),
      { type: 'setDuration', duration: 'h' },
      { type: 'insertNote', pitch: 'E', baseOctave: 4 },
    );
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
    const low = run(
      fresh(),
      { type: 'shiftOctave', delta: -1 },
      { type: 'insertNote', pitch: 'G', baseOctave: 4 },
    );
    expect(low.song.events).toEqual([note('G', 3, 'q')]);

    const tooLow = run(
      fresh(),
      { type: 'shiftOctave', delta: -1 },
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
    );
    expect(tooLow.song.events).toEqual([]);
    expect(tooLow.error).toBe(
      'That C is too low — Note Chomp notes go from the G below middle C up to high C (G3–C6).',
    );

    const high = run(
      fresh(),
      { type: 'shiftOctave', delta: 1 },
      { type: 'insertNote', pitch: 'C', baseOctave: 5 },
    );
    expect(high.song.events).toEqual([note('C', 6, 'q')]);

    const tooHigh = run(
      fresh(),
      { type: 'shiftOctave', delta: 1 },
      { type: 'insertNote', pitch: 'D', baseOctave: 5 },
    );
    expect(tooHigh.song.events).toEqual([]);
    expect(tooHigh.error).toBe(
      'That D is too high — Note Chomp notes go from the G below middle C up to high C (G3–C6).',
    );
  });

  it('does not offer dotted eighths', () => {
    const cleared = run(fresh(), { type: 'toggleDotted' }, { type: 'setDuration', duration: 'e' });
    expect(cleared.dotted).toBe(false);
    expect(run(cleared, { type: 'toggleDotted' }).dotted).toBe(false);
    const s = run(
      cleared,
      { type: 'toggleDotted' },
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
    );
    expect(s.song.events).toEqual([note('C', 4, 'e')]);
    expect(
      run(cleared, { type: 'setDuration', duration: 'q' }, { type: 'toggleDotted' }).dotted,
    ).toBe(true);
  });

  it('clamps the octave shift to ±1', () => {
    const s = run(fresh(), { type: 'shiftOctave', delta: 1 }, { type: 'shiftOctave', delta: 1 });
    expect(s.octaveShift).toBe(1);
  });

  it('rejects an insert that would cross a bar line', () => {
    const s = run(
      fresh(),
      { type: 'setDuration', duration: 'h' },
      { type: 'toggleDotted' },
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
    const bad = run(
      fresh(),
      { type: 'shiftOctave', delta: -1 },
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
    );
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
      events: [
        note('C', 4, 'q'),
        note('D', 4, 'q'),
        note('E', 4, 'h'),
        note('F', 4, 'h'),
        note('G', 4, 'h'),
      ],
    };
    const s = run(
      createEditorState(song),
      { type: 'setCursor', index: 2 },
      { type: 'deleteBackward' },
    );
    expect(s.song.events).toEqual([
      note('C', 4, 'q'),
      rest('q'),
      note('E', 4, 'h'),
      note('F', 4, 'h'),
      note('G', 4, 'h'),
    ]);
    expect(s.cursor).toBe(1);
    expect(s.error).toBeNull();
    expect(s.past).toHaveLength(1);
    // keeps going backwards instead of getting stuck on the new rest
    const next = run(s, { type: 'deleteBackward' });
    expect(next.song.events).toEqual([
      rest('q'),
      rest('q'),
      note('E', 4, 'h'),
      note('F', 4, 'h'),
      note('G', 4, 'h'),
    ]);
    expect(next.cursor).toBe(0);
  });

  it('just steps back over a rest that cannot be removed', () => {
    const song = {
      ...createEmptySong('Rest'),
      id: 'id-4',
      events: [
        note('C', 4, 'q'),
        rest('q'),
        note('E', 4, 'h'),
        note('F', 4, 'h'),
        note('G', 4, 'h'),
      ],
    };
    const s = run(
      createEditorState(song),
      { type: 'setCursor', index: 2 },
      { type: 'deleteBackward' },
    );
    expect(s.song).toBe(song);
    expect(s.cursor).toBe(1);
    expect(s.past).toEqual([]);
  });

  it('clamps cursor movement', () => {
    const s = run(
      fresh(),
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      { type: 'moveCursor', delta: -5 },
    );
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
    for (let i = 0; i < HISTORY_LIMIT + 20; i++)
      s = editorReducer(s, { type: 'insertNote', pitch: 'C', baseOctave: 4 });
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
    const loaded = run(
      fresh(),
      { type: 'insertNote', pitch: 'C', baseOctave: 4 },
      {
        type: 'load',
        song: { ...createEmptySong('Other'), id: 'id-2' },
      },
    );
    expect(loaded.song.id).toBe('id-2');
    expect(loaded.past).toEqual([]);
    expect(run(fresh(), { type: 'insertRest' }, { type: 'markSaved' }).dirty).toBe(false);
  });
});
