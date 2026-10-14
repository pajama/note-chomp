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
