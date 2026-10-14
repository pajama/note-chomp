import { useEffect, useRef } from 'react';
import type { EditorAction } from '../../core/editor/editorReducer';
import type { Pitch } from '../../core/model/types';

/** Everything a key can do in the editor: a reducer action, or start/stop playback. */
export type EditorCommand = EditorAction | { type: 'togglePlayback' };

interface KeyInfo {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface KeyContext {
  hasSelection: boolean;
}

export function keyToCommand(e: KeyInfo, { hasSelection }: KeyContext): EditorCommand | undefined {
  const mod = e.ctrlKey || e.metaKey;
  const lower = e.key.toLowerCase();
  if (mod && lower === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
  if (mod && lower === 'y') return { type: 'redo' };
  if (mod || e.altKey) return undefined;
  if (lower.length === 1 && 'cdefgab'.includes(lower)) {
    const pitch = lower.toUpperCase() as Pitch;
    return hasSelection
      ? { type: 'changeSelectedPitch', pitch, baseOctave: 4 }
      : { type: 'insertNote', pitch, baseOctave: 4 };
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
      return hasSelection ? { type: 'restSelected' } : { type: 'insertRest' };
    case 'Backspace':
    case 'Delete':
      return { type: 'deleteBackward' };
    case 'ArrowLeft':
      return { type: 'navigate', delta: -1 };
    case 'ArrowRight':
      return { type: 'navigate', delta: 1 };
    case 'ArrowUp':
      return hasSelection && !e.shiftKey
        ? { type: 'nudgeSelected', steps: 1 }
        : { type: 'shiftOctave', delta: 1 };
    case 'ArrowDown':
      return hasSelection && !e.shiftKey
        ? { type: 'nudgeSelected', steps: -1 }
        : { type: 'shiftOctave', delta: -1 };
    case 'Escape':
      return { type: 'clearSelection' };
    case ' ':
      return { type: 'togglePlayback' };
    default:
      return undefined;
  }
}

/** Keys typed here belong to the field. The tempo slider is not one: it only keeps its arrows. */
const TEXT_FIELDS = 'input:not([type="range"]), textarea, select, [contenteditable="true"]';
/**
 * Space keeps its native meaning only here. Other buttons (fruit keys, lengths, Undo…) keep focus
 * after a tap, and "tap fruits, press Space to listen" must play, not tap the fruit again.
 */
const SPACE_OWNERS = `${TEXT_FIELDS}, a[href], .play-button, .help-button`;

export function useEditorKeyboard(
  onCommand: (command: EditorCommand) => void,
  hasSelection: boolean,
): void {
  const latest = useRef({ onCommand, hasSelection });
  useEffect(() => {
    latest.current = { onCommand, hasSelection };
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(TEXT_FIELDS)) return;
      if (target?.matches('input[type="range"]') && e.key.startsWith('Arrow')) return;
      if (e.key === ' ' && target?.closest(SPACE_OWNERS)) return;
      const command = keyToCommand(e, { hasSelection: latest.current.hasSelection });
      if (!command) return;
      e.preventDefault();
      latest.current.onCommand(command);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
