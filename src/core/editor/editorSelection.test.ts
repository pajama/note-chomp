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
