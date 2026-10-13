# Phase 6b — Interaction: keyboard, auto-scroll & announcements (Tasks 17–18)

Both tasks edit `src/app/pages/EditorPage.tsx` as left by the previous task. Each "replace" anchor appears exactly once.

### Task 17: Selection-aware keyboard

**Files:**
- Modify (full replacement): `src/app/hooks/useEditorKeyboard.ts`, `src/app/hooks/useEditorKeyboard.test.ts` (the v1 test file is rewritten for the new signature: `keyToAction` → `keyToCommand`, arrows → `navigate`)
- Modify: `src/app/pages/EditorPage.tsx`

**Interfaces:**
- Consumes: reducer actions from Tasks 5–7; `playback.play/stop/playing` and `previewPitch` (Task 15).
- Produces (used by Tasks 23–25):
  - `type EditorCommand = EditorAction | { type: 'togglePlayback' }`
  - `interface KeyContext { hasSelection: boolean }`
  - `keyToCommand(e: KeyInfo, ctx: KeyContext): EditorCommand | undefined` — C–B: `changeSelectedPitch` with a selection else `insertNote` (base octave 4); 1–4 lengths; `.` dot; R: `restSelected` / `insertRest`; Backspace/Delete: `deleteBackward`; ←/→: `navigate ∓1`; ↑/↓: `nudgeSelected ±1` with a selection, else `shiftOctave ±1`; Shift+↑/↓: always `shiftOctave`; Esc: `clearSelection`; Space: `togglePlayback`; Ctrl/⌘+Z / Shift+Z / Y: undo/redo.
  - `useEditorKeyboard(onCommand: (command: EditorCommand) => void, hasSelection: boolean): void` — ignores keys typed into inputs/textareas/selects/contenteditable; leaves Space to focused buttons and links.
  - In `EditorWorkspace`: `togglePlayback()` (stop if playing/loading, else play from the selection or the start) and `onCommand` (previews note keys, then dispatches).

- [ ] **Step 1: Write the failing test**

**Replace `src/app/hooks/useEditorKeyboard.test.ts` with:**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/app/hooks/useEditorKeyboard.test.ts`
Expected: FAIL — `keyToCommand is not a function` / `does not provide an export named 'keyToCommand'`.

- [ ] **Step 3: Implement the key map**

**Replace `src/app/hooks/useEditorKeyboard.ts` with:**

```ts
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

const TEXT_FIELDS = 'input, textarea, select, [contenteditable="true"]';
/** Space would also press a focused button or move a slider, so leave it to them. */
const SPACE_OWNERS = `${TEXT_FIELDS}, button, a[href]`;

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/app/hooks`
Expected: PASS. (`npm run typecheck` fails until Step 5: `EditorPage` still calls `useEditorKeyboard(dispatch)`.)

- [ ] **Step 5: Route keys through the editor**

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
```

with:

```tsx
import { useEditorKeyboard, type EditorCommand } from '../hooks/useEditorKeyboard';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  const selected = state.selection === null ? undefined : state.song.events[state.selection];

  useEditorKeyboard(dispatch);
```

with:

```tsx
  const selected = state.selection === null ? undefined : state.song.events[state.selection];
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  const onRest = () =>
    dispatch(state.selection === null ? { type: 'insertRest' } : { type: 'restSelected' });
```

with:

```tsx
  const onRest = () =>
    dispatch(state.selection === null ? { type: 'insertRest' } : { type: 'restSelected' });

  const togglePlayback = () => {
    if (playback.playing) playback.stop();
    else playback.play(state.selection ?? 0);
  };

  const onCommand = (command: EditorCommand) => {
    if (command.type === 'togglePlayback') return togglePlayback();
    if (command.type === 'insertNote' || command.type === 'changeSelectedPitch') {
      previewPitch(command.pitch, command.baseOctave);
    }
    dispatch(command);
  };
  useEditorKeyboard(onCommand, state.selection !== null);
```

- [ ] **Step 6: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
```

Expected: all pass — the v1 e2e test "builds a song by tapping fruit and typing" still types `g` and Backspace with nothing selected.

```bash
git add src/app/hooks/useEditorKeyboard.ts src/app/hooks/useEditorKeyboard.test.ts src/app/pages/EditorPage.tsx
git commit -m "feat(editor): keys change the selection, arrows navigate and nudge, Esc deselects, Space plays"
```

---

### Task 18: Auto-scroll & announcements

**Files:**
- Create: `src/app/editorFocus.ts`
- Modify: `src/app/components/EditorSheet.tsx`, `src/app/pages/EditorPage.tsx`
- Test: `src/app/editorFocus.test.ts`

**Interfaces:**
- Consumes: `describeEvent` (Task 13); SheetSvg data attributes (`data-kind="note-target"` + `data-event-index`, `data-kind="cursor"`).
- Produces (used by Tasks 23, 25):
  - `scrollAnchorSelector(playing: number | null, selection: number | null): string` — the playing note's column, else the selected note's column, else the cursor.
  - `selectionAnnouncement(events: MusicEvent[], selection: number | null): string` — `"Selected Note 2: D, quarter note"` or `''`.
  - `EditorSheet` scrolls that anchor into view (`block: 'nearest'`, smooth) after every edit, move, selection change or playback step.
  - `EditorPage` renders `<div class="sr-only" aria-live="polite" data-testid="selection-announcer">` with the announcement.

- [ ] **Step 1: Write the failing test**

**Create `src/app/editorFocus.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { note, rest } from '../core/model/factories';
import { scrollAnchorSelector, selectionAnnouncement } from './editorFocus';

describe('scrollAnchorSelector', () => {
  it('follows the playing note first, then the selection, then the cursor', () => {
    expect(scrollAnchorSelector(4, 1)).toBe('[data-kind="note-target"][data-event-index="4"]');
    expect(scrollAnchorSelector(null, 1)).toBe('[data-kind="note-target"][data-event-index="1"]');
    expect(scrollAnchorSelector(null, null)).toBe('[data-kind="cursor"]');
  });
});

describe('selectionAnnouncement', () => {
  const events = [note('G', 4, 'q'), rest('h')];
  it('describes the selected event', () => {
    expect(selectionAnnouncement(events, 0)).toBe('Selected Note 1: G, quarter note');
    expect(selectionAnnouncement(events, 1)).toBe('Selected Note 2: half rest');
  });
  it('is empty without a selection', () => {
    expect(selectionAnnouncement(events, null)).toBe('');
    expect(selectionAnnouncement(events, 7)).toBe('');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/app/editorFocus.test.ts`
Expected: FAIL — `Failed to resolve import "./editorFocus"`.

- [ ] **Step 3: Implement the helpers**

**Create `src/app/editorFocus.ts`:**

```ts
import { describeEvent } from '../core/editor/describe';
import type { MusicEvent } from '../core/model/types';

/** What the sheet should keep in view: the playing note, else the selected note, else the cursor. */
export function scrollAnchorSelector(playing: number | null, selection: number | null): string {
  const index = playing ?? selection;
  return index === null
    ? '[data-kind="cursor"]'
    : `[data-kind="note-target"][data-event-index="${index}"]`;
}

/** Text for the polite live region when the selection changes. */
export function selectionAnnouncement(events: MusicEvent[], selection: number | null): string {
  const event = selection === null ? undefined : events[selection];
  return event && selection !== null ? `Selected ${describeEvent(event, selection)}` : '';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/app/editorFocus.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Follow the action in the sheet**

**Edit `src/app/components/EditorSheet.tsx`** — replace:

```tsx
import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
```

with:

```tsx
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
```

**Edit `src/app/components/EditorSheet.tsx`** — replace:

```tsx
import { SheetSvg } from '../../render/svg/SheetSvg';
```

with:

```tsx
import { SheetSvg } from '../../render/svg/SheetSvg';
import { scrollAnchorSelector } from '../editorFocus';
```

**Edit `src/app/components/EditorSheet.tsx`** — replace:

```tsx
/** The scrolling sheet in the middle of the editor. */
```

with:

```tsx
/** The scrolling sheet in the middle of the editor. Keeps the cursor / selection / playing note in view. */
```

**Edit `src/app/components/EditorSheet.tsx`** — replace:

```tsx
}: EditorSheetProps) {
  const view = useMemo(() => {
```

with:

```tsx
}: EditorSheetProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const view = useMemo(() => {
```

**Edit `src/app/components/EditorSheet.tsx`** — replace:

```tsx
  }, [song]);

  if (!view.ok) {
```

with:

```tsx
  }, [song]);

  // After any edit, move, or playback step: keep the thing you're looking at on screen.
  useEffect(() => {
    const anchor = scroller.current?.querySelector(scrollAnchorSelector(playing, selection));
    anchor?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [playing, selection, cursor, song.events]);

  if (!view.ok) {
```

**Edit `src/app/components/EditorSheet.tsx`** — replace:

```tsx
    <div className="sheet-scroll" data-testid="song-pages">
```

with:

```tsx
    <div className="sheet-scroll" ref={scroller} data-testid="song-pages">
```

(`scrollIntoView?.` — jsdom/older engines may not implement it on SVG elements.)

- [ ] **Step 6: Announce the selection**

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { Toast } from '../components/Toast';
```

with:

```tsx
import { Toast } from '../components/Toast';
import { selectionAnnouncement } from '../editorFocus';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
        onGapClick={onGapClick}
      />
```

with:

```tsx
        onGapClick={onGapClick}
      />

      <div className="sr-only" aria-live="polite" data-testid="selection-announcer">
        {selectionAnnouncement(state.song.events, state.selection)}
      </div>
```

- [ ] **Step 7: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
```

In the debug Chrome tab at 1280×800, type 30 notes on `#/new`: the newest note and the cursor stay visible while the sheet scrolls; play a long song (Jingle Bells): the view follows the halo.

```bash
git add src/app/editorFocus.ts src/app/editorFocus.test.ts src/app/components/EditorSheet.tsx src/app/pages/EditorPage.tsx
git commit -m "feat(editor): keep the cursor, selection and playing note in view; announce the selection"
```
