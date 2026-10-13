# Phase 6a — Interaction: playback & drag (Tasks 15–16)

Both tasks edit `src/app/pages/EditorPage.tsx` as left by the previous task. Each "replace" anchor appears exactly once.

### Task 15: Playback in the editor

**Files:**
- Modify: `src/app/pages/EditorPage.tsx`

**Interfaces:**
- Consumes: `usePlayback` (Task 11), `PlaybackControls` (Task 12), `isInRange`, `toNoteName` (Task 1), `EditorSheet`'s `playing` prop (Task 14).
- Produces (used by Tasks 16, 17, 24): in `EditorWorkspace` — `playback = usePlayback(state.song)`; `previewPitch(pitch, baseOctave)` (previews `pitch` at `baseOctave + octaveShift` if in range); fruit-key taps preview before changing/inserting; ▶ Play plays from the selected note (`state.selection ?? 0`) else from the start; the playing event is highlighted (`playing={playback.currentEventIndex}`); playback errors (piano failed to load) become a toast. Dock order: Play/tempo, lengths, ?.

This task only wires units that already have tests (Tasks 8–12); its end-to-end spec is Task 24. Verify with the existing suites plus a real-audio check in the browser.

- [ ] **Step 1: Wire playback into the page**

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { TIME_SIGNATURES, type Pitch, type Song, type TimeSignature } from '../../core/model/types';
```

with:

```tsx
import { TIME_SIGNATURES, type Pitch, type Song, type TimeSignature } from '../../core/model/types';
import { isInRange, toNoteName } from '../../core/theory/pitch';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { HelpPopover } from '../components/HelpPopover';
```

with:

```tsx
import { HelpPopover } from '../components/HelpPopover';
import { PlaybackControls } from '../components/PlaybackControls';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
```

with:

```tsx
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { usePlayback } from '../hooks/usePlayback';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  const toast = useToast();
```

with:

```tsx
  const toast = useToast();
  const playback = usePlayback(state.song);
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
    const timer = setTimeout(() => setFlashMeasure(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashMeasure]);
```

with:

```tsx
    const timer = setTimeout(() => setFlashMeasure(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashMeasure]);
  const { error: playbackError, dismissError: dismissPlaybackError } = playback;
  useEffect(() => {
    if (!playbackError) return;
    show(playbackError);
    dismissPlaybackError();
  }, [playbackError, dismissPlaybackError, show]);
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  const onNote = (pitch: Pitch, baseOctave: 4 | 5) => {
    dispatch(
```

with:

```tsx
  const previewPitch = (pitch: Pitch, baseOctave: 4 | 5) => {
    const octave = baseOctave + state.octaveShift;
    if (isInRange(pitch, octave)) playback.preview(toNoteName(pitch, octave));
  };

  const onNote = (pitch: Pitch, baseOctave: 4 | 5) => {
    previewPitch(pitch, baseOctave);
    dispatch(
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
        playing={null}
```

with:

```tsx
        playing={playback.currentEventIndex}
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
        <div className="dock-row">
          <DurationPicker
```

with:

```tsx
        <div className="dock-row">
          <PlaybackControls
            status={playback.status}
            canPlay={state.song.events.length > 0}
            bpm={playback.bpm}
            onPlay={() => playback.play(state.selection ?? 0)}
            onStop={playback.stop}
            onBpm={playback.setBpm}
          />
          <DurationPicker
```

- [ ] **Step 2: Run the suites**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
```

Expected: all pass (25 e2e).

- [ ] **Step 3: Listen to it in the shared debug Chrome (real Tone.js)**

Start the dev server if needed (`timeout 5 lsof -iTCP:5173 -sTCP:LISTEN || (npm run dev -- --port 5173 > /tmp/note-chomp-dev.log 2>&1 &)`), check `curl -fsS --max-time 2 http://127.0.0.1:9222/json/version` (else ask the user to run `! gcdb`), open a new tab at `http://localhost:5173/#/edit/builtin-twinkle-twinkle`, click ▶ Play. Expected: the button reads "Loading piano…" briefly, then "■ Stop"; piano notes sound; a yellow halo moves note by note; at the end it returns to "▶ Play". Move the tempo slider to 🐇 and play again (faster). Tap a fruit key: a short preview plays. Close only your tab.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/EditorPage.tsx
git commit -m "feat(editor): play, stop, tempo, previews and playing highlight"
```

---

### Task 16: Pointer select & drag

**Files:**
- Create: `src/app/hooks/useNoteDrag.ts`
- Modify: `src/app/pages/EditorPage.tsx`
- Test: `src/app/hooks/useNoteDrag.test.ts`

**Interfaces:**
- Consumes: reducer actions `select`, `dragSelected`, `endDrag` (Tasks 5–6); `clampedStepPitch`, `toNoteName` (Task 1); `EDITOR_OPTIONS` (Task 14); `playback.preview` (Task 15); `SheetSvg`'s `onNotePointerDown(eventIndex, event)` (Task 13).
- Produces (used by Task 23):
  - `DRAG_THRESHOLD_PX = 4`
  - `dragSteps(dy: number, staffSpacePx: number): number` = `round(−dy / (staffSpacePx / 2))` (0 when the size is unknown)
  - `staffSpacePx(svg: SVGSVGElement | null, staffSpaceMm: number): number` — on-screen px per staff space from the svg's rendered width ÷ viewBox width.
  - `useNoteDrag({ events, dispatch, preview, staffSpaceMm }: NoteDragOptions): (eventIndex: number, e: React.PointerEvent<SVGRectElement>) => void` — on primary-button pointerdown: `select`, preview the note, capture the pointer; vertical movement beyond 4 px starts a drag; every change of `dragSteps` dispatches `dragSelected { steps }` and previews the new pitch; pointerup/pointercancel dispatches `endDrag` (only if a drag happened). Rests are selectable but not draggable.

- [ ] **Step 1: Write the failing test**

**Create `src/app/hooks/useNoteDrag.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { dragSteps, staffSpacePx } from './useNoteDrag';

describe('dragSteps', () => {
  it('moves one line or space per half staff space, upward positive', () => {
    expect(dragSteps(-10, 20)).toBe(1);
    expect(dragSteps(-20, 20)).toBe(2);
    expect(dragSteps(30, 20)).toBe(-3);
  });
  it('rounds to the nearest step', () => {
    expect(dragSteps(-4, 20)).toBe(0);
    expect(dragSteps(-6, 20)).toBe(1);
    expect(dragSteps(4, 20)).toBe(0);
  });
  it('is 0 when the staff has no size yet', () => {
    expect(dragSteps(-50, 0)).toBe(0);
  });
});

describe('staffSpacePx', () => {
  const svg = (viewWidth: number, pxWidth: number) =>
    ({
      viewBox: { baseVal: { width: viewWidth } },
      getBoundingClientRect: () => ({ width: pxWidth }),
    }) as unknown as SVGSVGElement;

  it('scales staff space from sheet units (mm) to on-screen px', () => {
    expect(staffSpacePx(svg(200, 800), 6.5)).toBe(26);
  });
  it('is 0 without an svg or before it has a size', () => {
    expect(staffSpacePx(null, 6.5)).toBe(0);
    expect(staffSpacePx(svg(0, 800), 6.5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/app/hooks/useNoteDrag.test.ts`
Expected: FAIL — `Failed to resolve import "./useNoteDrag"`.

- [ ] **Step 3: Implement the hook**

**Create `src/app/hooks/useNoteDrag.ts`:**

```ts
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { EditorAction } from '../../core/editor/editorReducer';
import type { MusicEvent } from '../../core/model/types';
import { clampedStepPitch, toNoteName } from '../../core/theory/pitch';

/** A press becomes a drag once it moves this far vertically. */
export const DRAG_THRESHOLD_PX = 4;

/** Diatonic steps for a vertical drag of `dy` px (up is positive); one step = half a staff space. */
export function dragSteps(dy: number, staffSpacePx: number): number {
  if (staffSpacePx <= 0) return 0;
  return Math.round(-dy / (staffSpacePx / 2)) || 0;
}

interface Press {
  pointerId: number;
  startY: number;
  spacePx: number;
  event: MusicEvent;
  dragging: boolean;
  steps: number;
}

export interface NoteDragOptions {
  events: MusicEvent[];
  dispatch: (action: EditorAction) => void;
  preview: (note: string) => void;
  /** Staff space in sheet units (mm); converted to px from the sheet's on-screen size. */
  staffSpaceMm: number;
}

/** On-screen px per staff space for the <svg> a note target lives in. */
export function staffSpacePx(svg: SVGSVGElement | null, staffSpaceMm: number): number {
  const viewWidth = svg?.viewBox.baseVal?.width ?? 0;
  if (!svg || viewWidth <= 0) return 0;
  return (svg.getBoundingClientRect().width / viewWidth) * staffSpaceMm;
}

/** pointerdown on a note column: select + preview; vertical drag: change pitch; release: one undo step. */
export function useNoteDrag({ events, dispatch, preview, staffSpaceMm }: NoteDragOptions) {
  const latest = useRef({ events, dispatch, preview, staffSpaceMm });
  useEffect(() => {
    latest.current = { events, dispatch, preview, staffSpaceMm };
  });
  const press = useRef<Press | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return useCallback((eventIndex: number, e: ReactPointerEvent<SVGRectElement>) => {
    const { events: current, dispatch: send, preview: play } = latest.current;
    const event = current[eventIndex];
    if (!event || e.button !== 0) return;
    e.preventDefault();
    send({ type: 'select', index: eventIndex });
    if (event.kind === 'note') play(toNoteName(event.pitch, event.octave));
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      spacePx: staffSpacePx(e.currentTarget.ownerSVGElement, latest.current.staffSpaceMm),
      event,
      dragging: false,
      steps: 0,
    };

    const onMove = (m: PointerEvent) => {
      const p = press.current;
      if (!p || m.pointerId !== p.pointerId || p.event.kind !== 'note') return;
      const dy = m.clientY - p.startY;
      if (!p.dragging && Math.abs(dy) <= DRAG_THRESHOLD_PX) return;
      p.dragging = true;
      const steps = dragSteps(dy, p.spacePx);
      if (steps === p.steps) return;
      p.steps = steps;
      latest.current.dispatch({ type: 'dragSelected', steps });
      const moved = clampedStepPitch(p.event.pitch, p.event.octave, steps);
      latest.current.preview(toNoteName(moved.pitch, moved.octave));
    };
    const onEnd = (u: PointerEvent) => {
      const p = press.current;
      if (!p || u.pointerId !== p.pointerId) return;
      if (p.dragging) latest.current.dispatch({ type: 'endDrag' });
      press.current = null;
      cleanup.current?.();
    };
    cleanup.current?.();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    cleanup.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      cleanup.current = null;
    };
  }, []);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/app/hooks`
Expected: PASS (5 new tests; v1 key-map tests unchanged).

- [ ] **Step 5: Use it in the editor**

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { EditorSheet } from '../components/EditorSheet';
```

with:

```tsx
import { EDITOR_OPTIONS, EditorSheet } from '../components/EditorSheet';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
```

with:

```tsx
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { useNoteDrag } from '../hooks/useNoteDrag';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  const onNotePointerDown = useCallback((index: number) => dispatch({ type: 'select', index }), []);
```

with:

```tsx
  const onNotePointerDown = useNoteDrag({
    events: state.song.events,
    dispatch,
    preview: playback.preview,
    staffSpaceMm: EDITOR_OPTIONS.staffSpaceMm,
  });
```

- [ ] **Step 6: Verify everything (and drag by hand) and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
```

In the debug Chrome tab (see Task 15 Step 3), on `#/new` type `e`, press on the lemon and drag up about one staff space: it becomes a blueberry (G) with a preview at each step; Undo puts it back in one step. The automated drag test is Task 23.

```bash
git add src/app/hooks/useNoteDrag.ts src/app/hooks/useNoteDrag.test.ts src/app/pages/EditorPage.tsx
git commit -m "feat(editor): press a note to select it, drag up/down to change its pitch"
```

