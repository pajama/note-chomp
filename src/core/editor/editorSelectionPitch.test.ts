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
