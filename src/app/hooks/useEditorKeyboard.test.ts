import { describe, expect, it } from 'vitest';
import { keyToCommand } from './useEditorKeyboard';

type Mods = Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }>;
const press = (k: string, mods: Mods = {}, hasSelection = false) =>
  keyToCommand(
    { key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods },
    { hasSelection },
  );
const key = (k: string, mods: Mods = {}) => press(k, mods, false);
const selected = (k: string, mods: Mods = {}) => press(k, mods, true);

describe('keyToCommand', () => {
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
    expect(key('Delete')).toEqual({ type: 'deleteBackward' });
    expect(key('ArrowLeft')).toEqual({ type: 'navigate', delta: -1 });
    expect(key('ArrowRight')).toEqual({ type: 'navigate', delta: 1 });
    expect(key('ArrowUp')).toEqual({ type: 'shiftOctave', delta: 1 });
    expect(key('ArrowDown')).toEqual({ type: 'shiftOctave', delta: -1 });
    expect(key('Escape')).toEqual({ type: 'clearSelection' });
    expect(key(' ')).toEqual({ type: 'togglePlayback' });
  });
  it('changes the selected note instead of inserting when one is selected', () => {
    expect(selected('a')).toEqual({ type: 'changeSelectedPitch', pitch: 'A', baseOctave: 4 });
    expect(selected('r')).toEqual({ type: 'restSelected' });
    expect(selected('ArrowUp')).toEqual({ type: 'nudgeSelected', steps: 1 });
    expect(selected('ArrowDown')).toEqual({ type: 'nudgeSelected', steps: -1 });
  });
  it('Shift+↑/↓ always shifts the octave', () => {
    expect(selected('ArrowUp', { shiftKey: true })).toEqual({ type: 'shiftOctave', delta: 1 });
    expect(selected('ArrowDown', { shiftKey: true })).toEqual({ type: 'shiftOctave', delta: -1 });
  });
  it('maps undo/redo shortcuts and ignores other modified keys', () => {
    expect(key('z', { metaKey: true })).toEqual({ type: 'undo' });
    expect(key('z', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'redo' });
    expect(key('y', { ctrlKey: true })).toEqual({ type: 'redo' });
    expect(key('c', { ctrlKey: true })).toBeUndefined();
    expect(key('x')).toBeUndefined();
  });
});
