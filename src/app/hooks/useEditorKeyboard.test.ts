import { describe, expect, it } from 'vitest';
import { keyToAction } from './useEditorKeyboard';

const key = (
  k: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {},
) =>
  keyToAction({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

describe('keyToAction', () => {
  it('maps letters to notes in the middle octave', () => {
    expect(key('g')).toEqual({ type: 'insertNote', pitch: 'G', baseOctave: 4 });
    expect(key('C', { shiftKey: true })).toEqual({ type: 'insertNote', pitch: 'C', baseOctave: 4 });
  });
  it('maps number keys to durations and other editing keys', () => {
    expect(key('1')).toEqual({ type: 'setDuration', duration: 'w' });
    expect(key('4')).toEqual({ type: 'setDuration', duration: 'e' });
    expect(key('.')).toEqual({ type: 'toggleDotted' });
    expect(key('r')).toEqual({ type: 'insertRest' });
    expect(key('Backspace')).toEqual({ type: 'deleteBackward' });
    expect(key('ArrowLeft')).toEqual({ type: 'moveCursor', delta: -1 });
    expect(key('ArrowUp')).toEqual({ type: 'shiftOctave', delta: 1 });
  });
  it('maps undo/redo shortcuts and ignores other modified keys', () => {
    expect(key('z', { metaKey: true })).toEqual({ type: 'undo' });
    expect(key('z', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'redo' });
    expect(key('y', { ctrlKey: true })).toEqual({ type: 'redo' });
    expect(key('c', { ctrlKey: true })).toBeUndefined();
    expect(key('x')).toBeUndefined();
  });
});
