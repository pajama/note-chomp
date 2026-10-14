# Phase 5 — Editor layout v2 (Task 14)

### Task 14: Editor layout v2: top bar, scrolling sheet, dock, toast, click-to-select

**Files:**
- Create: `src/app/components/EditorSheet.tsx`
- Modify (full replacement): `src/app/pages/EditorPage.tsx`
- Modify: `src/app/App.tsx` (editor-mode class), `src/app/styles.css` (append), `e2e/editor.spec.ts` (alert → toast)
- Test: `e2e/editor.spec.ts` (updated v1 test)

**Interfaces:**
- Consumes: reducer actions `select`, `setCursor`, `changeSelectedPitch`, `restSelected`, `dismissError` and `state.selection` / `state.errorMeasure` (Tasks 5–7); `layoutSong`, `compactSheet`, `editorHitTargets`, `cursorPosition`, `measureBox`, `DEFAULT_RENDER_OPTIONS` (layout barrel, Tasks 3–4); `SheetSvg` (Task 13); `Toast`, `useToast`, `HelpPopover` (Task 12); v1 `DurationPicker`, `FruitKeyboard`, `useEditorKeyboard(dispatch)` (unchanged until Task 17).
- Produces (used by Tasks 15–22):
  - `EDITOR_OPTIONS` (= `DEFAULT_RENDER_OPTIONS`) and `<EditorSheet song cursor selection playing flashMeasure onNotePointerDown onGapClick onBackgroundPointerDown? />` (`EditorSheetProps`): lays out the song (memoised on `song`), renders `SheetSvg` inside `<div class="sheet-scroll" data-testid="song-pages">` (the v1 e2e helper `fruits()` keeps working), passes the cursor only when nothing is selected, and turns `flashMeasure` into a `measureBox`. A pointerdown anywhere on the sheet that is not a note column or gap (margins, clef, between systems, but not the scrollbar) calls `onBackgroundPointerDown`. A layout error renders the v1 inline alert.
  - `EditorPage` layout: `.editor` = `.editor-topbar` (title, time signature, Undo, Redo, Save, Print) + `EditorSheet` + `.editor-dock` (toast region, `.dock-row` with `DurationPicker` and `HelpPopover`, then `FruitKeyboard`). The v1 alert and tip line are gone. Reducer errors → `toast.show(error)` + 1.2 s measure flash, then `dismissError`; save errors → toast. Fruit keys call `changeSelectedPitch` when a note is selected, else `insertNote`; Rest calls `restSelected` / `insertRest`; the length buttons show the selected event's length. Pointerdown on a note column dispatches `select`; clicking a gap dispatches `setCursor`; a press on blank sheet dispatches `clearSelection` (the mouse way to let go of a note, besides Esc).
  - `App` root gets class `app app-editor` on `#/new` and `#/edit/…` (full-height flex layout: only the sheet scrolls).

- [ ] **Step 1: Change the v1 e2e test to expect the toast (failing test)**

**Edit `e2e/editor.spec.ts`** — replace:

```ts
  await expect(page.getByRole('alert')).toContainText("doesn't fit");
```

with:

```ts
  await expect(page.getByTestId('toast')).toContainText("doesn't fit");
```

- [ ] **Step 2: Run it to verify it fails**

Run (sandbox disabled): `timeout 300 npx playwright test e2e/editor.spec.ts -g "does not fit"`
Expected: FAIL — `getByTestId('toast')` not found (the message is still an alert).

- [ ] **Step 3: Add the sheet wrapper**

**Create `src/app/components/EditorSheet.tsx`:**

```tsx
import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import {
  compactSheet,
  cursorPosition,
  DEFAULT_RENDER_OPTIONS,
  editorHitTargets,
  layoutSong,
  measureBox,
} from '../../core/layout';
import type { Song } from '../../core/model/types';
import { SheetSvg } from '../../render/svg/SheetSvg';
import { messageOf } from '../useSongLibrary';

/** The editor always shows the default (Large) staff; print options apply only to Print. */
export const EDITOR_OPTIONS = DEFAULT_RENDER_OPTIONS;

export interface EditorSheetProps {
  song: Song;
  cursor: number;
  selection: number | null;
  playing: number | null;
  /** Measure to flash after an error (1-based), or null. */
  flashMeasure: number | null;
  onNotePointerDown: (eventIndex: number, e: ReactPointerEvent<SVGRectElement>) => void;
  onGapClick: (index: number) => void;
  /** A press on blank sheet: margins, clef, between systems. */
  onBackgroundPointerDown?: () => void;
}

/** The scrolling sheet in the middle of the editor. */
export function EditorSheet({
  song,
  cursor,
  selection,
  playing,
  flashMeasure,
  onNotePointerDown,
  onGapClick,
  onBackgroundPointerDown,
}: EditorSheetProps) {
  const view = useMemo(() => {
    try {
      const result = layoutSong(song, EDITOR_OPTIONS);
      return {
        ok: true as const,
        result,
        sheet: compactSheet(result, EDITOR_OPTIONS.staffSpaceMm),
        targets: editorHitTargets(result),
      };
    } catch (e) {
      return { ok: false as const, message: messageOf(e) };
    }
  }, [song]);

  if (!view.ok) {
    return (
      <p className="alert error" role="alert">
        {view.message}
      </p>
    );
  }

  const onSheetPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-kind="note-target"], [data-kind="gap-target"]')) return;
    // On the scroller itself, a press right of its content box is on the scrollbar.
    if (target === e.currentTarget && e.nativeEvent.offsetX >= e.currentTarget.clientWidth) return;
    onBackgroundPointerDown?.();
  };
  return (
    <div className="sheet-scroll" data-testid="song-pages" onPointerDown={onSheetPointerDown}>
      <SheetSvg
        sheet={view.sheet}
        targets={view.targets}
        events={song.events}
        title={song.title}
        cursor={
          selection === null
            ? cursorPosition(view.result, cursor, EDITOR_OPTIONS.staffSpaceMm)
            : undefined
        }
        selection={selection}
        playing={playing}
        flash={flashMeasure === null ? null : measureBox(view.result, flashMeasure)}
        onNotePointerDown={onNotePointerDown}
        onGapClick={onGapClick}
      />
    </div>
  );
}
```

- [ ] **Step 4: Rebuild the editor page**

**Replace `src/app/pages/EditorPage.tsx` with:**

```tsx
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createEditorState, editorReducer } from '../../core/editor/editorReducer';
import { createEmptySong } from '../../core/model/factories';
import { newSongId } from '../../core/model/id';
import { TIME_SIGNATURES, type Pitch, type Song, type TimeSignature } from '../../core/model/types';
import { clearDraft, saveDraft } from '../../persistence/draft';
import { DurationPicker } from '../components/DurationPicker';
import { EditorSheet } from '../components/EditorSheet';
import { FruitKeyboard } from '../components/FruitKeyboard';
import { HelpPopover } from '../components/HelpPopover';
import { Toast } from '../components/Toast';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { useToast } from '../hooks/useToast';
import { navigate, setNavigationGuard } from '../router';
import { useServices } from '../services';
import { messageOf, useSongLibrary, type SongLibrary } from '../useSongLibrary';

export const LEAVE_UNSAVED_MESSAGE = 'Your song is not saved yet. Leave without saving it?';
/** How long the problem measure flashes after an error. */
const FLASH_MS = 1200;

interface EditorPageProps {
  songId?: string;
  /** Called when a save gives the song an address of its own, just before going there. */
  onSavedAs?: (id: string) => void;
}

export function EditorPage({ songId, onSavedAs }: EditorPageProps) {
  const library = useSongLibrary();
  if (songId === undefined)
    return (
      <EditorWorkspace initialSong={createEmptySong()} library={library} onSavedAs={onSavedAs} />
    );
  if (library.status === 'loading') return <p>Loading…</p>;
  const entry = library.find(songId);
  if (!entry) {
    return (
      <section className="panel">
        <h1>Song not found</h1>
        <p>
          <a href="#/">Back to the songbook</a>
        </p>
      </section>
    );
  }
  const initial = entry.builtin
    ? { ...entry.song, id: newSongId(), title: `${entry.song.title} (my copy)` }
    : entry.song;
  return <EditorWorkspace initialSong={initial} library={library} onSavedAs={onSavedAs} />;
}

function EditorWorkspace({
  initialSong,
  library,
  onSavedAs,
}: {
  initialSong: Song;
  library: SongLibrary;
  onSavedAs?: (id: string) => void;
}) {
  const { storage } = useServices();
  const [state, dispatch] = useReducer(editorReducer, initialSong, createEditorState);
  const [saving, setSaving] = useState(false);
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
  const toast = useToast();
  const selected = state.selection === null ? undefined : state.song.events[state.selection];

  useEditorKeyboard(dispatch);

  // Reducer errors become a toast plus a brief flash on the measure they are about.
  const { show } = toast;
  useEffect(() => {
    if (!state.error) return;
    show(state.error);
    setFlashMeasure(state.errorMeasure);
    dispatch({ type: 'dismissError' });
  }, [state.error, state.errorMeasure, show]);
  useEffect(() => {
    if (flashMeasure === null) return;
    const timer = setTimeout(() => setFlashMeasure(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashMeasure]);

  useEffect(() => {
    if (state.dirty) saveDraft(storage, state.song);
  }, [state.song, state.dirty, storage]);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  // Leaving inside the app (header links, Back, #/ links) is a hash change, not an unload.
  // A ref, so a save can clear it before its own navigation without waiting for a re-render.
  const dirtyRef = useRef(state.dirty);
  useLayoutEffect(() => {
    dirtyRef.current = state.dirty;
  }, [state.dirty]);
  useEffect(
    () => setNavigationGuard(() => !dirtyRef.current || window.confirm(LEAVE_UNSAVED_MESSAGE)),
    [],
  );

  const onNote = (pitch: Pitch, baseOctave: 4 | 5) => {
    dispatch(
      state.selection === null
        ? { type: 'insertNote', pitch, baseOctave }
        : { type: 'changeSelectedPitch', pitch, baseOctave },
    );
  };

  const onRest = () =>
    dispatch(state.selection === null ? { type: 'insertRest' } : { type: 'restSelected' });

  const onNotePointerDown = useCallback((index: number) => dispatch({ type: 'select', index }), []);
  const onGapClick = useCallback((index: number) => dispatch({ type: 'setCursor', index }), []);
  const onBackgroundPointerDown = useCallback(() => dispatch({ type: 'clearSelection' }), []);

  const save = async (): Promise<Song | undefined> => {
    setSaving(true);
    try {
      const saved = await library.save(state.song);
      dispatch({ type: 'markSaved' });
      dirtyRef.current = false;
      clearDraft(storage);
      return saved;
    } catch (e) {
      show(messageOf(e));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    const saved = await save();
    if (!saved) return;
    onSavedAs?.(saved.id);
    navigate({ name: 'edit', id: saved.id });
  };

  const onPrint = async () => {
    const needsSave = state.dirty || library.find(state.song.id) === undefined;
    const saved = needsSave ? await save() : state.song;
    if (saved) navigate({ name: 'print', id: saved.id });
  };

  return (
    <div className="editor">
      <div className="editor-topbar toolbar no-print">
        <input
          type="text"
          aria-label="Song title"
          maxLength={100}
          value={state.song.title}
          onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
        />
        <select
          aria-label="Time signature"
          value={state.song.timeSignature}
          onChange={(e) =>
            dispatch({ type: 'setTimeSignature', timeSignature: e.target.value as TimeSignature })
          }
        >
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts} value={ts}>
              {ts}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary"
          disabled={state.past.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
        >
          Undo
        </button>
        <button
          type="button"
          className="secondary"
          disabled={state.future.length === 0}
          onClick={() => dispatch({ type: 'redo' })}
        >
          Redo
        </button>
        <button type="button" disabled={saving} onClick={() => void onSave()}>
          {state.dirty || library.find(state.song.id) === undefined ? 'Save' : 'Saved'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={saving || state.song.events.length === 0}
          onClick={() => void onPrint()}
        >
          Print
        </button>
      </div>

      <EditorSheet
        song={state.song}
        cursor={state.cursor}
        selection={state.selection}
        playing={null}
        flashMeasure={flashMeasure}
        onNotePointerDown={onNotePointerDown}
        onBackgroundPointerDown={onBackgroundPointerDown}
        onGapClick={onGapClick}
      />

      <div className="editor-dock no-print">
        <Toast message={toast.toast} onDismiss={toast.dismiss} />
        <div className="dock-row">
          <DurationPicker
            duration={selected?.duration ?? state.duration}
            dotted={selected ? !!selected.dotted : state.dotted}
            timeSignature={state.song.timeSignature}
            onDuration={(duration) => dispatch({ type: 'setDuration', duration })}
            onToggleDot={() => dispatch({ type: 'toggleDotted' })}
            onRest={onRest}
            onBackspace={() => dispatch({ type: 'deleteBackward' })}
          />
          <HelpPopover />
        </div>
        <FruitKeyboard
          octaveShift={state.octaveShift}
          onNote={onNote}
          onShift={(delta) => dispatch({ type: 'shiftOctave', delta })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Full-height editor layout**

**Edit `src/app/App.tsx`** — replace:

```tsx
export function App() {
  const route = useRoute();
  return (
    <div className="app">
```

with:

```tsx
export function App() {
  const route = useRoute();
  const inEditor = route.name === 'new' || route.name === 'edit';
  return (
    <div className={inEditor ? 'app app-editor' : 'app'}>
```

**Append to `src/app/styles.css`:**

```css
/* ---------- Editor v2: sticky top bar, scrolling sheet, bottom dock ---------- */
.app-editor {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.app-editor .app-main {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: none;
  padding: 0;
  display: flex;
}
.editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.editor-topbar {
  flex: none;
  margin: 0;
  padding: 10px 24px;
  background: var(--paper);
  border-bottom: 1px solid #eceff1;
}
.editor-topbar input[type='text'] {
  flex: 1 1 220px;
  min-width: 0;
}
.draft-offer {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 10px 24px 0;
}
.sheet-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.sheet-svg {
  width: 100%;
  max-width: 960px;
  height: auto;
  background: #fff;
  border-radius: var(--radius);
  box-shadow: 0 2px 10px rgb(0 0 0 / 6%);
}
.note-target {
  cursor: pointer;
  touch-action: none;
}
.note-target:hover {
  fill: rgb(92 107 192 / 8%);
}
.gap-target {
  cursor: text;
}
.playing-halo {
  transform-box: fill-box;
  transform-origin: center;
  animation: playing-pop 0.25s ease-out;
}
@keyframes playing-pop {
  from {
    transform: scale(0.7);
  }
  to {
    transform: scale(1);
  }
}
.measure-flash {
  animation: measure-flash 1.2s ease-out forwards;
}
@keyframes measure-flash {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
.editor-dock {
  flex: none;
  position: relative;
  display: grid;
  gap: 8px;
  padding: 10px 24px 14px;
  background: var(--paper);
  box-shadow: 0 -2px 10px rgb(0 0 0 / 8%);
}
.dock-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.dock-row .toolbar {
  margin: 0;
}
.editor-dock .octave-controls {
  margin-bottom: 4px;
}
.editor-dock .fruit-key {
  min-height: 64px;
}
.editor-dock .fruit-key svg {
  width: 36px;
  height: 36px;
}
.playback-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.play-button {
  min-width: 132px;
}
.tempo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1.3rem;
}
.tempo input {
  width: 110px;
}
.help {
  position: relative;
  margin-left: auto;
}
.help-button {
  width: 44px;
  padding: 0;
  font-size: 1.2rem;
}
.help-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  width: min(420px, 90vw);
  z-index: 10;
}
.help-popover ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}
.toast-region {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  width: max-content;
  max-width: min(640px, 92vw);
  z-index: 20;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #e8f5e9;
  border: 2px solid #81c784;
  box-shadow: 0 4px 16px rgb(0 0 0 / 15%);
  pointer-events: auto;
}
.toast.error {
  background: #ffebee;
  border-color: #e57373;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 800px) {
  .editor-topbar,
  .editor-dock,
  .sheet-scroll {
    padding-left: 12px;
    padding-right: 12px;
  }
  .editor-dock .fruit-keyboard {
    gap: 4px;
  }
  .editor-dock .fruit-key {
    min-height: 52px;
    padding: 4px;
  }
  .editor-dock .fruit-key svg {
    width: 28px;
    height: 28px;
  }
  .help {
    margin-left: 0;
  }
}
```

(Some rules — `.playback-controls`, `.tempo`, `.sr-only`, `.playing-halo`, `.draft-offer` — style elements added in Tasks 15, 18 and 20; keeping the editor CSS in one block avoids touching this file again.)

- [ ] **Step 6: Run the e2e suite**

Run (sandbox disabled): `lsof -iTCP:5179 -sTCP:LISTEN; timeout 600 npm run test:e2e`
Expected: PASS — all 25 tests, including the updated toast test. (`fruits()` still finds fruit inside `data-testid="song-pages"`; v1 tests never click fruit on the staff.)

- [ ] **Step 7: Look at it in the shared debug Chrome**

Load the `browser-automation-gcdb` skill first (this check clicks and types in the shared browser). Then:

```bash
curl -fsS --max-time 2 http://127.0.0.1:9222/json/version || echo "ask the user to run: ! gcdb"
timeout 5 lsof -iTCP:5173 -sTCP:LISTEN || echo "dev server not running"
```

If the dev server is not running, start `npm run dev -- --port 5173` with the Bash tool's `run_in_background: true` (not a shell `&`, which orphans the process) and wait until `curl -fsS --max-time 2 http://localhost:5173/ > /dev/null` succeeds. With the Playwright MCP browser tools, open a **new tab** at `http://localhost:5173/#/edit/builtin-ode-to-joy` at 1280×800 and check: the top bar is at the top, the dock (lengths, ?, fruit keys) at the bottom, only the sheet scrolls, systems have no paper margins or legend; clicking a fruit shows a blue glow and hides the pink cursor; a fruit key then changes that note; clicking between notes brings the cursor back; selecting a note and then clicking the blank margin beside the staff lets go of it (glow gone, cursor back); an impossible length shows a toast above the dock and a red flash on the measure. Close only the tab you opened.

- [ ] **Step 8: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/app/components/EditorSheet.tsx src/app/pages/EditorPage.tsx src/app/App.tsx src/app/styles.css e2e/editor.spec.ts
git commit -m "feat(editor): sticky top bar, scrolling compact sheet, bottom dock, toast and click-to-select"
```
