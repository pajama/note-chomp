# Phase 6b — Songbook, editor, and import pages

UI tasks are driven by Playwright e2e tests (write the spec first, watch it fail against the stub page, then build the page). Pure helpers get unit tests.

### Task 23: Songbook page

**Files:**
- Create: `src/app/components/SongPages.tsx`, `src/app/components/FruitStrip.tsx`, `e2e/songbook.spec.ts`
- Modify: `src/app/pages/SongbookPage.tsx` (replace stub), `src/app/styles.css` (append)

**Interfaces:**
- Consumes: `useSongLibrary`, `messageOf` (22), `navigate`, `routeToHash` (22), `downloadText` (22), `slugify` (22), `serializeSong`, `NOTECHOMP_EXTENSION` (16), `newSongId` (2), `layoutSong`, `cursorPosition`, `DEFAULT_RENDER_OPTIONS`, `RenderOptions` (11/14), `PageSvg` (14), `FruitArt` (12)
- Produces:
  - `SongPages(props: { song: Song; options?: RenderOptions; cursorIndex?: number; onEventClick?: (eventIndex: number) => void }): JSX.Element` — `data-testid="song-pages"`, one `.page-svg` per page; shows an inline error instead of throwing if layout fails
  - `FruitStrip(props: { song: Song; max?: number }): JSX.Element`
  - `SongbookPage()` — "My songs" (Print / Edit / Export / Delete) and "Starter songs" (Print / Make a copy); cards have `data-testid="song-card"`

- [ ] **Step 1: Write the failing e2e test**

`e2e/songbook.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('lists the eight starter songs and an empty My songs section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Starter songs' })).toBeVisible();
  await expect(page.getByTestId('song-card')).toHaveCount(8);
  await expect(page.getByTestId('song-card').filter({ hasText: 'Hot Cross Buns' })).toBeVisible();
  await expect(page.getByText('No songs yet.')).toBeVisible();
});

test('copies a starter song, then deletes the copy', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('song-card').filter({ hasText: 'Ode to Joy' }).getByRole('button', { name: 'Make a copy' }).click();
  await expect(page).toHaveURL(/#\/edit\//);

  await page.goto('/');
  const copy = page.getByTestId('song-card').filter({ hasText: 'Ode to Joy (my copy)' });
  await expect(copy).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await copy.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No songs yet.')).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/songbook.spec.ts`
Expected: FAIL — no "Starter songs" heading (stub page).

- [ ] **Step 3: Implement shared components**

`src/app/components/SongPages.tsx`:

```tsx
import { useMemo } from 'react';
import { cursorPosition, DEFAULT_RENDER_OPTIONS, layoutSong, type RenderOptions } from '../../core/layout';
import type { Song } from '../../core/model/types';
import { PageSvg } from '../../render/svg/PageSvg';
import { messageOf } from '../useSongLibrary';

export interface SongPagesProps {
  song: Song;
  options?: RenderOptions;
  cursorIndex?: number;
  onEventClick?: (eventIndex: number) => void;
}

export function SongPages({ song, options = DEFAULT_RENDER_OPTIONS, cursorIndex, onEventClick }: SongPagesProps) {
  const layout = useMemo(() => {
    try {
      return { ok: true as const, result: layoutSong(song, options) };
    } catch (e) {
      return { ok: false as const, message: messageOf(e) };
    }
  }, [song, options]);

  if (!layout.ok) {
    return (
      <p className="alert error" role="alert">
        {layout.message}
      </p>
    );
  }
  const cursor =
    cursorIndex === undefined ? undefined : cursorPosition(layout.result, cursorIndex, options.staffSpaceMm);
  return (
    <div className="song-pages" data-testid="song-pages">
      {layout.result.pages.map((page) => (
        <PageSvg key={page.index} page={page} cursor={cursor} onEventClick={onEventClick} className="page-svg" />
      ))}
    </div>
  );
}
```

`src/app/components/FruitStrip.tsx`:

```tsx
import type { Note, Song } from '../../core/model/types';
import { FruitArt } from '../../render/art/fruits';

export function FruitStrip({ song, max = 10 }: { song: Song; max?: number }) {
  const notes = song.events.filter((e): e is Note => e.kind === 'note').slice(0, max);
  return (
    <svg className="fruit-strip" viewBox={`0 0 ${Math.max(notes.length, 1)} 1`} aria-hidden="true">
      {notes.map((n, i) => (
        <g key={i} transform={`translate(${i + 0.5} 0.5) scale(0.85)`}>
          <FruitArt pitch={n.pitch} hollow={n.duration === 'h' || n.duration === 'w'} />
        </g>
      ))}
    </svg>
  );
}
```

Append to `src/app/styles.css`:

```css
.fruit-strip { height: 32px; width: auto; max-width: 100%; }
.muted { color: var(--muted); margin: 0; }
.songbook section { margin-bottom: 32px; }
```

- [ ] **Step 4: Implement `src/app/pages/SongbookPage.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import { newSongId } from '../../core/model/id';
import type { Song } from '../../core/model/types';
import { slugify } from '../../core/text';
import { NOTECHOMP_EXTENSION, serializeSong } from '../../formats/notechomp/notechomp';
import { FruitStrip } from '../components/FruitStrip';
import { downloadText } from '../download';
import { navigate, routeToHash } from '../router';
import { messageOf, useSongLibrary } from '../useSongLibrary';

function SongCard({ song, actions }: { song: Song; actions: ReactNode }) {
  const noteCount = song.events.filter((e) => e.kind === 'note').length;
  return (
    <article className="panel song-card" data-testid="song-card">
      <h3>{song.title}</h3>
      <FruitStrip song={song} />
      <p className="muted">
        {song.timeSignature} · {noteCount} notes
      </p>
      <div className="actions">{actions}</div>
    </article>
  );
}

export function SongbookPage() {
  const library = useSongLibrary();
  const [error, setError] = useState<string | null>(null);

  const copy = async (song: Song) => {
    try {
      const saved = await library.save({ ...song, id: newSongId(), title: `${song.title} (my copy)` });
      navigate({ name: 'edit', id: saved.id });
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const remove = async (song: Song) => {
    if (!window.confirm(`Delete "${song.title}"? This can't be undone.`)) return;
    try {
      await library.remove(song.id);
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const exportJson = (song: Song) =>
    downloadText(`${slugify(song.title)}${NOTECHOMP_EXTENSION}`, serializeSong(song), 'application/json');

  return (
    <div className="songbook">
      {error && <p className="alert error" role="alert">{error}</p>}
      {library.status === 'error' && (
        <p className="alert error" role="alert">
          Couldn't load your songs: {library.error}
        </p>
      )}

      <section>
        <h2>My songs</h2>
        {library.status === 'loading' ? (
          <p>Loading…</p>
        ) : library.user.length === 0 ? (
          <p className="panel">
            No songs yet. <a href="#/new">Make one</a>, <a href="#/import">import one</a>, or copy a starter song below.
          </p>
        ) : (
          <div className="song-grid">
            {library.user.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                actions={
                  <>
                    <a className="button" href={routeToHash({ name: 'print', id: song.id })}>Print</a>
                    <a className="button secondary" href={routeToHash({ name: 'edit', id: song.id })}>Edit</a>
                    <button type="button" className="secondary" onClick={() => exportJson(song)}>Export</button>
                    <button type="button" className="danger" onClick={() => void remove(song)}>Delete</button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Starter songs</h2>
        <div className="song-grid">
          {library.builtin.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              actions={
                <>
                  <a className="button" href={routeToHash({ name: 'print', id: song.id })}>Print</a>
                  <button type="button" className="secondary" onClick={() => void copy(song)}>Make a copy</button>
                </>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx playwright test e2e/songbook.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e`

```bash
git add src e2e && git commit -m "feat(app): songbook with starter songs, copies, export and delete"
```

---

### Task 24: Editor page (tap editor)

**Files:**
- Create: `src/app/components/FruitKeyboard.tsx`, `src/app/components/DurationPicker.tsx`, `src/app/components/durationChoices.ts`, `src/app/components/durationChoices.test.ts`, `src/app/hooks/useEditorKeyboard.ts`, `src/app/hooks/useEditorKeyboard.test.ts`, `e2e/editor.spec.ts`
- Modify: `src/app/pages/EditorPage.tsx` (replace stub), `src/app/styles.css` (append)

**Interfaces:**
- Consumes: `editorReducer`, `createEditorState`, `EditorAction`, `OctaveShift` (15); `SongPages` (23); `useSongLibrary`, `SongLibrary`, `messageOf`, `useServices`, `navigate`, `routeToHash` (22); `saveDraft`, `clearDraft` (20); `createEmptySong`, `newSongId`, `TIME_SIGNATURES`, `PITCHES` (2); `isInRange` (3); `eventUnits`, `measureUnits` (4); `FruitArt` (12)
- Produces:
  - `keyToAction(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): EditorAction | undefined`
  - `useEditorKeyboard(dispatch: (action: EditorAction) => void): void` — ignores keys typed into inputs/selects/textareas
  - `FruitKeyboard(props: { octaveShift: OctaveShift; onNote: (pitch: Pitch, baseOctave: 4 | 5) => void; onShift: (delta: 1 | -1) => void })` — buttons with accessible names `Add <pitch><octave>`, disabled when out of range; the top (high) C key shows `C↑` and a small dot above its apple so it can't be confused with the low C
  - `durationTooLong(duration: Duration, ts: TimeSignature): boolean` — the plain duration is longer than one measure
  - `dotUnavailable(duration: Duration, ts: TimeSignature): string | null` — why the dot can't be added (`"Dotted eighths aren't available yet"` or `"Too long for <ts>"`), or `null`
  - `DurationPicker(props: { duration: Duration; dotted: boolean; timeSignature: TimeSignature; onDuration: (d: Duration) => void; onToggleDot: () => void; onRest: () => void; onBackspace: () => void })` — `Whole` is disabled with title `Too long for 3/4` (or `2/4`) when the measure is shorter than 4/4; `Dot` is disabled while Eighth is selected and when the dotted note would overflow the measure (e.g. dotted half in 2/4) — but never while it is pressed, so it can always be switched off
  - `EditorPage({ songId }: { songId?: string })` — opening a built-in song edits a copy (`"<title> (my copy)"`, new id)

Keyboard map: `c d e f g a b` → note (middle octave + shift) · `1 2 3 4` → whole/half/quarter/eighth · `.` → dot · `r` → rest · Backspace → delete · ←/→ → move cursor · ↑/↓ → octave · Ctrl/⌘+Z undo · Ctrl/⌘+Shift+Z or Ctrl/⌘+Y redo. Clicking a fruit puts the cursor right after it (so Backspace deletes it).

- [ ] **Step 1: Write the failing unit test for the key map**

`src/app/hooks/useEditorKeyboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { keyToAction } from './useEditorKeyboard';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) =>
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
```

`src/app/components/durationChoices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dotUnavailable, durationTooLong } from './durationChoices';

describe('durationTooLong', () => {
  it('only rules out notes longer than the measure', () => {
    expect(durationTooLong('w', '4/4')).toBe(false);
    expect(durationTooLong('w', '3/4')).toBe(true);
    expect(durationTooLong('w', '2/4')).toBe(true);
    expect(durationTooLong('h', '2/4')).toBe(false);
  });
});

describe('dotUnavailable', () => {
  it('never offers dotted eighths', () => {
    expect(dotUnavailable('e', '4/4')).toBe("Dotted eighths aren't available yet");
  });
  it('rules out dotted notes that overflow the measure', () => {
    expect(dotUnavailable('h', '2/4')).toBe('Too long for 2/4');
    expect(dotUnavailable('w', '4/4')).toBe('Too long for 4/4');
  });
  it('allows dots that fit', () => {
    expect(dotUnavailable('h', '3/4')).toBeNull();
    expect(dotUnavailable('q', '2/4')).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing e2e test**

`e2e/editor.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

const fruits = (page: Page) => page.getByTestId('song-pages').locator('[data-kind="fruit"]');

test('builds a song by tapping fruit and typing, then saves it', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Add C4' }).click();
  await page.getByRole('button', { name: 'Add D4' }).click();
  await page.getByRole('button', { name: 'Add E4' }).click();
  await expect(fruits(page)).toHaveCount(3);

  await page.keyboard.press('g');
  await expect(fruits(page)).toHaveCount(4);
  await page.keyboard.press('Backspace');
  await expect(fruits(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(fruits(page)).toHaveCount(4);

  await page.getByLabel('Song title').fill('My Fruit Song');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/#\/edit\//);

  await page.goto('/');
  await expect(page.getByTestId('song-card').filter({ hasText: 'My Fruit Song' })).toBeVisible();
});

test('explains when a note does not fit in the measure', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Half', exact: true }).click();
  await page.getByRole('button', { name: 'Dot', exact: true }).click();
  await page.getByRole('button', { name: 'Add C4' }).click();
  await page.getByRole('button', { name: 'Dot', exact: true }).click();
  await page.getByRole('button', { name: 'Add D4' }).click();
  await expect(page.getByRole('alert')).toContainText("doesn't fit");
  await expect(fruits(page)).toHaveCount(1);
});

test('the low octave reaches G3 and disables notes below it', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Lower notes' }).click();
  await expect(page.getByRole('button', { name: 'Add C3' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add G3' }).click();
  await expect(fruits(page)).toHaveCount(1);
  await expect(fruits(page).first()).toHaveAttribute('data-pitch', 'G');
});

test('length buttons follow the time signature', async ({ page }) => {
  await page.goto('/#/new');
  const whole = page.getByRole('button', { name: 'Whole', exact: true });
  const dot = page.getByRole('button', { name: 'Dot', exact: true });
  await expect(whole).toBeEnabled();
  await page.getByLabel('Time signature').selectOption('3/4');
  await expect(whole).toBeDisabled();
  await expect(whole).toHaveAttribute('title', 'Too long for 3/4');

  await page.getByLabel('Time signature').selectOption('2/4');
  await page.getByRole('button', { name: 'Half', exact: true }).click();
  await expect(dot).toBeDisabled();
  await page.getByRole('button', { name: 'Eighth', exact: true }).click();
  await expect(dot).toBeDisabled();
  await page.getByRole('button', { name: 'Quarter', exact: true }).click();
  await expect(dot).toBeEnabled();
});

test('the high C key is marked so it differs from the low C', async ({ page }) => {
  await page.goto('/#/new');
  const highC = page.getByRole('button', { name: 'Add C5' });
  await expect(highC).toContainText('C↑');
  await expect(highC.locator('[data-testid="high-dot"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Add C4' })).not.toContainText('↑');
});

test('opening a starter song edits a copy', async ({ page }) => {
  await page.goto('/#/edit/builtin-hot-cross-buns');
  await expect(page.getByLabel('Song title')).toHaveValue('Hot Cross Buns (my copy)');
  await expect(fruits(page)).toHaveCount(17);
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `npx vitest run src/app && npx playwright test e2e/editor.spec.ts`
Expected: FAIL — `./useEditorKeyboard` and `./durationChoices` missing; editor stub has no buttons.

- [ ] **Step 4: Implement the keyboard hook**

`src/app/hooks/useEditorKeyboard.ts`:

```ts
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
    case '1': return { type: 'setDuration', duration: 'w' };
    case '2': return { type: 'setDuration', duration: 'h' };
    case '3': return { type: 'setDuration', duration: 'q' };
    case '4': return { type: 'setDuration', duration: 'e' };
    case '.': return { type: 'toggleDotted' };
    case 'r':
    case 'R': return { type: 'insertRest' };
    case 'Backspace': return { type: 'deleteBackward' };
    case 'ArrowLeft': return { type: 'moveCursor', delta: -1 };
    case 'ArrowRight': return { type: 'moveCursor', delta: 1 };
    case 'ArrowUp': return { type: 'shiftOctave', delta: 1 };
    case 'ArrowDown': return { type: 'shiftOctave', delta: -1 };
    default: return undefined;
  }
}

export function useEditorKeyboard(dispatch: (action: EditorAction) => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const action = keyToAction(e);
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
```

- [ ] **Step 5: Implement the controls**

`src/app/components/FruitKeyboard.tsx`:

```tsx
import type { OctaveShift } from '../../core/editor/editorReducer';
import { PITCHES, type Pitch } from '../../core/model/types';
import { isInRange } from '../../core/theory/pitch';
import { FruitArt } from '../../render/art/fruits';

const KEYS: { pitch: Pitch; baseOctave: 4 | 5 }[] = [
  ...PITCHES.map((pitch) => ({ pitch, baseOctave: 4 as const })),
  { pitch: 'C', baseOctave: 5 },
];

const OCTAVE_LABELS: Record<OctaveShift, string> = { [-1]: 'Low', 0: 'Middle', 1: 'High' };

export interface FruitKeyboardProps {
  octaveShift: OctaveShift;
  onNote: (pitch: Pitch, baseOctave: 4 | 5) => void;
  onShift: (delta: 1 | -1) => void;
}

export function FruitKeyboard({ octaveShift, onNote, onShift }: FruitKeyboardProps) {
  return (
    <div className="fruit-keyboard-wrap">
      <div className="octave-controls">
        <button type="button" className="secondary" aria-label="Lower notes" disabled={octaveShift === -1} onClick={() => onShift(-1)}>
          ▼
        </button>
        <span>{OCTAVE_LABELS[octaveShift]} notes</span>
        <button type="button" className="secondary" aria-label="Higher notes" disabled={octaveShift === 1} onClick={() => onShift(1)}>
          ▲
        </button>
      </div>
      <div className="fruit-keyboard">
        {KEYS.map(({ pitch, baseOctave }) => {
          const octave = baseOctave + octaveShift;
          return (
            <button
              key={`${pitch}${baseOctave}`}
              type="button"
              className="fruit-key"
              aria-label={`Add ${pitch}${octave}`}
              disabled={!isInRange(pitch, octave)}
              onClick={() => onNote(pitch, baseOctave)}
            >
              <svg viewBox="-0.6 -0.75 1.2 1.35" aria-hidden="true">
                {baseOctave === 5 && <circle data-testid="high-dot" cx={0} cy={-0.64} r={0.08} fill="currentColor" />}
                <FruitArt pitch={pitch} hollow={false} />
              </svg>
              <span>{baseOctave === 5 ? `${pitch}↑` : pitch}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

`src/app/components/durationChoices.ts`:

```ts
import type { Duration, TimeSignature } from '../../core/model/types';
import { eventUnits, measureUnits } from '../../core/theory/rhythm';

export function durationTooLong(duration: Duration, ts: TimeSignature): boolean {
  return eventUnits({ duration }) > measureUnits(ts);
}

export function dotUnavailable(duration: Duration, ts: TimeSignature): string | null {
  if (duration === 'e') return "Dotted eighths aren't available yet";
  if (eventUnits({ duration, dotted: true }) > measureUnits(ts)) return `Too long for ${ts}`;
  return null;
}
```

`src/app/components/DurationPicker.tsx`:

```tsx
import type { Duration, TimeSignature } from '../../core/model/types';
import { dotUnavailable, durationTooLong } from './durationChoices';

const OPTIONS: { duration: Duration; label: string; hint: string }[] = [
  { duration: 'w', label: 'Whole', hint: '4 beats (key 1)' },
  { duration: 'h', label: 'Half', hint: '2 beats (key 2)' },
  { duration: 'q', label: 'Quarter', hint: '1 beat (key 3)' },
  { duration: 'e', label: 'Eighth', hint: '½ beat (key 4)' },
];

export interface DurationPickerProps {
  duration: Duration;
  dotted: boolean;
  timeSignature: TimeSignature;
  onDuration: (duration: Duration) => void;
  onToggleDot: () => void;
  onRest: () => void;
  onBackspace: () => void;
}

export function DurationPicker({
  duration,
  dotted,
  timeSignature,
  onDuration,
  onToggleDot,
  onRest,
  onBackspace,
}: DurationPickerProps) {
  // A pressed Dot is never disabled, so it can always be switched off.
  const dotReason = dotted ? null : dotUnavailable(duration, timeSignature);
  return (
    <div className="toolbar" role="group" aria-label="Note length">
      {OPTIONS.map((o) => {
        const tooLong = durationTooLong(o.duration, timeSignature);
        return (
          <button
            key={o.duration}
            type="button"
            className="secondary"
            aria-pressed={duration === o.duration}
            disabled={tooLong}
            title={tooLong ? `Too long for ${timeSignature}` : o.hint}
            onClick={() => onDuration(o.duration)}
          >
            {o.label}
          </button>
        );
      })}
      <button
        type="button"
        className="secondary"
        aria-pressed={dotted}
        disabled={dotReason !== null}
        title={dotReason ?? 'Dotted: 1½ times as long (key .)'}
        onClick={onToggleDot}
      >
        Dot
      </button>
      <button type="button" className="secondary" title="Add a rest (key R)" onClick={onRest}>
        Rest
      </button>
      <button type="button" className="secondary" aria-label="Delete note" title="Delete (Backspace)" onClick={onBackspace}>
        ⌫
      </button>
    </div>
  );
}
```

Append to `src/app/styles.css`:

```css
.editor-controls { display: grid; gap: 12px; margin-bottom: 20px; }
.octave-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-weight: 700; }
.hint { color: var(--muted); margin: 0; font-size: 0.9rem; }
```

- [ ] **Step 6: Implement `src/app/pages/EditorPage.tsx`**

```tsx
import { useEffect, useReducer, useState } from 'react';
import { createEditorState, editorReducer } from '../../core/editor/editorReducer';
import { createEmptySong } from '../../core/model/factories';
import { newSongId } from '../../core/model/id';
import { TIME_SIGNATURES, type Song, type TimeSignature } from '../../core/model/types';
import { clearDraft, saveDraft } from '../../persistence/draft';
import { DurationPicker } from '../components/DurationPicker';
import { FruitKeyboard } from '../components/FruitKeyboard';
import { SongPages } from '../components/SongPages';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { navigate } from '../router';
import { useServices } from '../services';
import { messageOf, useSongLibrary, type SongLibrary } from '../useSongLibrary';

export function EditorPage({ songId }: { songId?: string }) {
  const library = useSongLibrary();
  if (songId === undefined) return <EditorWorkspace initialSong={createEmptySong()} library={library} />;
  if (library.status === 'loading') return <p>Loading…</p>;
  const entry = library.find(songId);
  if (!entry) {
    return (
      <section className="panel">
        <h1>Song not found</h1>
        <p><a href="#/">Back to the songbook</a></p>
      </section>
    );
  }
  const initial = entry.builtin
    ? { ...entry.song, id: newSongId(), title: `${entry.song.title} (my copy)` }
    : entry.song;
  return <EditorWorkspace initialSong={initial} library={library} />;
}

function EditorWorkspace({ initialSong, library }: { initialSong: Song; library: SongLibrary }) {
  const { storage } = useServices();
  const [state, dispatch] = useReducer(editorReducer, initialSong, createEditorState);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEditorKeyboard(dispatch);

  useEffect(() => {
    if (state.dirty) saveDraft(storage, state.song);
  }, [state.song, state.dirty, storage]);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  const save = async (): Promise<Song | undefined> => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await library.save(state.song);
      dispatch({ type: 'markSaved' });
      clearDraft(storage);
      return saved;
    } catch (e) {
      setSaveError(messageOf(e));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    const saved = await save();
    if (saved) navigate({ name: 'edit', id: saved.id });
  };

  const onPrint = async () => {
    const needsSave = state.dirty || library.find(state.song.id) === undefined;
    const saved = needsSave ? await save() : state.song;
    if (saved) navigate({ name: 'print', id: saved.id });
  };

  const message = state.error ?? saveError;

  return (
    <div className="editor">
      <div className="toolbar no-print">
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
          onChange={(e) => dispatch({ type: 'setTimeSignature', timeSignature: e.target.value as TimeSignature })}
        >
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts} value={ts}>{ts}</option>
          ))}
        </select>
        <button type="button" className="secondary" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })}>
          Undo
        </button>
        <button type="button" className="secondary" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })}>
          Redo
        </button>
        <button type="button" disabled={saving} onClick={() => void onSave()}>
          {state.dirty ? 'Save' : 'Saved'}
        </button>
        <button type="button" className="secondary" disabled={saving || state.song.events.length === 0} onClick={() => void onPrint()}>
          Print
        </button>
      </div>

      {message && (
        <div className="alert error" role="alert">
          {message}{' '}
          <button type="button" className="secondary" onClick={() => { dispatch({ type: 'dismissError' }); setSaveError(null); }}>
            OK
          </button>
        </div>
      )}

      <div className="panel editor-controls no-print">
        <DurationPicker
          duration={state.duration}
          dotted={state.dotted}
          timeSignature={state.song.timeSignature}
          onDuration={(duration) => dispatch({ type: 'setDuration', duration })}
          onToggleDot={() => dispatch({ type: 'toggleDotted' })}
          onRest={() => dispatch({ type: 'insertRest' })}
          onBackspace={() => dispatch({ type: 'deleteBackward' })}
        />
        <FruitKeyboard
          octaveShift={state.octaveShift}
          onNote={(pitch, baseOctave) => dispatch({ type: 'insertNote', pitch, baseOctave })}
          onShift={(delta) => dispatch({ type: 'shiftOctave', delta })}
        />
        <p className="hint">
          Tip: type C–B to add notes, 1–4 for note lengths, R for a rest, “.” for a dot, arrows to move, Backspace to
          delete. Click a fruit to put the cursor right after it.
        </p>
      </div>

      <SongPages
        song={state.song}
        cursorIndex={state.cursor}
        onEventClick={(index) => dispatch({ type: 'setCursor', index: index + 1 })}
      />
    </div>
  );
}
```

- [ ] **Step 7: Run to verify both pass**

Run: `npx vitest run src/app && npx playwright test e2e/editor.spec.ts`
Expected: PASS.

- [ ] **Step 8: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e`

```bash
git add src e2e && git commit -m "feat(app): tap editor with fruit keyboard, durations, shortcuts, autosaved drafts"
```

---

### Task 25: Import page

**Files:**
- Create: `e2e/import.spec.ts`
- Modify: `src/app/pages/ImportPage.tsx` (replace stub)

**Interfaces:**
- Consumes: `importSong`, `ImportSource` (19), `ImportResult` (16), `SongPages` (23), `useSongLibrary`, `messageOf`, `navigate` (22)
- Produces: `ImportPage()` — paste box (`aria-label="Song text"`) + "Import text" button + file picker (`.abc,.musicxml,.xml,.mxl,.json`); on success shows warnings (role `status`), a preview, and "Save to my songs" / "Save and edit" / "Save and print"; on failure lists every error (role `alert`).

- [ ] **Step 1: Write the failing e2e test**

`e2e/import.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const ABC = 'X:1\nT:Pasted Tune\nM:4/4\nL:1/4\nK:C\nE D C2 | E D C2 |]\nw: hot cross buns\n';

const XML = `<?xml version="1.0"?><score-partwise><work><work-title>From MuseScore</work-title></work>
<part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1">
<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;

test('imports pasted ABC, shows warnings and a preview, and saves it', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByLabel('Song text').fill(ABC);
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('heading', { name: 'Pasted Tune' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Lyrics were ignored.');
  await expect(page.getByTestId('song-pages').locator('[data-kind="fruit"]')).toHaveCount(6);

  await page.getByRole('button', { name: 'Save to my songs' }).click();
  await expect(page.getByTestId('song-card').filter({ hasText: 'Pasted Tune' })).toBeVisible();
});

test('explains why a song could not be imported', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByLabel('Song text').fill('X:1\nT:Sharp\nM:4/4\nL:1/4\nK:C\n^F4 |\n');
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('alert')).toContainText("F♯ isn't in the key of C");
});

test('imports a MusicXML file', async ({ page }) => {
  await page.goto('/#/import');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'song.musicxml', mimeType: 'application/xml', buffer: Buffer.from(XML),
  });
  await expect(page.getByRole('heading', { name: 'From MuseScore' })).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/import.spec.ts`
Expected: FAIL — stub page.

- [ ] **Step 3: Implement `src/app/pages/ImportPage.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react';
import { importSong, type ImportSource } from '../../formats/importSong';
import type { ImportResult } from '../../formats/types';
import { SongPages } from '../components/SongPages';
import { navigate } from '../router';
import { messageOf, useSongLibrary } from '../useSongLibrary';

const PLACEHOLDER = 'X:1\nT:Hot Cross Buns\nM:4/4\nL:1/4\nK:C\nE D C2 | E D C2 |]';

export function ImportPage() {
  const library = useSongLibrary();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const run = (source: ImportSource) => {
    setSaveError(null);
    setResult(importSong(source));
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    run({ kind: 'file', name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    input.value = '';
  };

  const saveAnd = async (next: 'songbook' | 'edit' | 'print') => {
    if (!result?.ok) return;
    try {
      const saved = await library.save(result.song);
      navigate(next === 'songbook' ? { name: 'songbook' } : { name: next, id: saved.id });
    } catch (e) {
      setSaveError(messageOf(e));
    }
  };

  return (
    <div className="import">
      <section className="panel">
        <h1>Import a song</h1>
        <p>
          Paste ABC notation, MusicXML, or a Note Chomp file — or choose a file (.abc, .musicxml, .xml, .mxl, .json).
        </p>
        <textarea
          aria-label="Song text"
          rows={10}
          style={{ width: '100%', fontFamily: 'ui-monospace, monospace' }}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="toolbar">
          <button type="button" disabled={!text.trim()} onClick={() => run({ kind: 'text', text })}>
            Import text
          </button>
          <label className="button secondary">
            Choose a file
            <input type="file" accept=".abc,.musicxml,.xml,.mxl,.json" hidden onChange={(e) => void onFile(e)} />
          </label>
        </div>
      </section>

      {result && !result.ok && (
        <div className="alert error" role="alert">
          <strong>We couldn't import that song:</strong>
          <ul>
            {result.errors.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {result?.ok && (
        <section className="panel">
          <h2>{result.song.title}</h2>
          {result.warnings.length > 0 && (
            <div className="alert" role="status">
              <strong>Heads up:</strong>
              <ul>
                {result.warnings.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          {saveError && <p className="alert error" role="alert">{saveError}</p>}
          <div className="toolbar">
            <button type="button" onClick={() => void saveAnd('songbook')}>Save to my songs</button>
            <button type="button" className="secondary" onClick={() => void saveAnd('edit')}>Save and edit</button>
            <button type="button" className="secondary" onClick={() => void saveAnd('print')}>Save and print</button>
          </div>
          <SongPages song={result.song} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test e2e/import.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e`

```bash
git add src e2e && git commit -m "feat(app): import page for ABC, MusicXML, .mxl and Note Chomp files"
```
