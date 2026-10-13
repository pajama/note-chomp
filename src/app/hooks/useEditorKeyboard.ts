import { useEffect } from 'react';
import type { EditorAction } from '../../core/editor/editorReducer';
import type { Pitch } from '../../core/model/types';

interface KeyInfo {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function keyToAction(e: KeyInfo): EditorAction | undefined {
  const mod = e.ctrlKey || e.metaKey;
  const lower = e.key.toLowerCase();
  if (mod && lower === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
  if (mod && lower === 'y') return { type: 'redo' };
  if (mod || e.altKey) return undefined;
  if (lower.length === 1 && 'cdefgab'.includes(lower)) {
    return { type: 'insertNote', pitch: lower.toUpperCase() as Pitch, baseOctave: 4 };
  }
  switch (e.key) {
    case '1':
      return { type: 'setDuration', duration: 'w' };
    case '2':
      return { type: 'setDuration', duration: 'h' };
    case '3':
      return { type: 'setDuration', duration: 'q' };
    case '4':
      return { type: 'setDuration', duration: 'e' };
    case '.':
      return { type: 'toggleDotted' };
    case 'r':
    case 'R':
      return { type: 'insertRest' };
    case 'Backspace':
      return { type: 'deleteBackward' };
    case 'ArrowLeft':
      return { type: 'moveCursor', delta: -1 };
    case 'ArrowRight':
      return { type: 'moveCursor', delta: 1 };
    case 'ArrowUp':
      return { type: 'shiftOctave', delta: 1 };
    case 'ArrowDown':
      return { type: 'shiftOctave', delta: -1 };
    default:
      return undefined;
  }
}

export function useEditorKeyboard(dispatch: (action: EditorAction) => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      const action = keyToAction(e);
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
