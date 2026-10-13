# Phase 7a — Quick fixes: New song, focus, draft restore (Tasks 19–20)

Spec §6. Their end-to-end tests are in Task 25.

### Task 19: New song on #/new & shortcut focus

**Files:**
- Modify: `src/app/router.ts`, `src/app/App.tsx` (full replacement), `src/app/pages/EditorPage.tsx`
- Test: `src/app/routerGuard.test.ts` (import line + new `describe`)

**Interfaces:**
- Consumes: v1 router guard (`setNavigationGuard`, `subscribeToRoute`, `onHashChange`); `clearDraft` (v1).
- Produces (used by Task 25):
  - `type LeaveReason = 'navigate' | 'new-song'`; `NavigationGuard = (reason: LeaveReason) => boolean` (hash changes pass `'navigate'`).
  - `confirmLeave(reason: LeaveReason): boolean` — asks the current guard; true without one.
  - `App`: `useEditorKey` returns `{ key, adopt, reset }` and lives in `App`; the header "New song" link, when the route is already `new`, prevents the (no-op) hash change and calls `confirmLeave('new-song')` → `reset()` (fresh editor).
  - `EditorPage`: `NEW_SONG_MESSAGE = "Start a new song? Your current one isn't saved."`; the guard asks with that message for `'new-song'` (and clears the draft when you agree), with `LEAVE_UNSAVED_MESSAGE` otherwise; no question when nothing is unsaved. Enter/Esc in the title box blur it; choosing a time signature blurs the select, so letter keys reach the editor again. The title box gets the placeholder "Name your song".

- [ ] **Step 1: Write the failing test**

**Edit `src/app/routerGuard.test.ts`** — replace:

```ts
import { setNavigationGuard, subscribeToRoute, currentHash } from './router';
```

with:

```ts
import {
  confirmLeave,
  currentHash,
  setNavigationGuard,
  subscribeToRoute,
  type LeaveReason,
} from './router';
```

**Append to `src/app/routerGuard.test.ts`:**

```ts
describe('confirmLeave', () => {
  it('says yes without a guard and asks the guard with the reason otherwise', () => {
    expect(confirmLeave('new-song')).toBe(true);
    const guard = vi.fn((reason: LeaveReason) => reason === 'navigate');
    const remove = setNavigationGuard(guard);
    expect(confirmLeave('new-song')).toBe(false);
    expect(confirmLeave('navigate')).toBe(true);
    expect(guard).toHaveBeenCalledWith('new-song');
    remove();
    expect(confirmLeave('new-song')).toBe(true);
  });

  it('passes "navigate" for hash changes', async () => {
    const guard = vi.fn(() => true);
    const cleanups = [subscribeToRoute(vi.fn()), setNavigationGuard(guard)];
    window.location.hash = '#/import';
    await hashChange();
    expect(guard).toHaveBeenCalledWith('navigate');
    cleanups.forEach((c) => c());
    window.history.replaceState(null, '', '#/');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/app/routerGuard.test.ts`
Expected: FAIL — `confirmLeave is not a function` and `expected "spy" to be called with arguments: [ 'navigate' ]`.

- [ ] **Step 3: Implement in the router**

**Edit `src/app/router.ts`** — replace:

```ts
/**
 * Asked before the app follows a hash change (a link, Back/Forward, or navigate()). Returning
 * false keeps the current page and puts its address back. One guard at a time: the editor.
 */
export type NavigationGuard = () => boolean;
```

with:

```ts
/** Why the guard is asked: leaving the page, or starting over on #/new ("New song" while already there). */
export type LeaveReason = 'navigate' | 'new-song';

/**
 * Asked before the app follows a hash change (a link, Back/Forward, or navigate()). Returning
 * false keeps the current page and puts its address back. One guard at a time: the editor.
 */
export type NavigationGuard = (reason: LeaveReason) => boolean;
```

**Edit `src/app/router.ts`** — replace:

```ts
/** The hash the app is showing
```

with:

```ts
/** Ask the current guard (if any) whether the page may be left for `reason`. */
export function confirmLeave(reason: LeaveReason): boolean {
  return guard ? guard(reason) : true;
}

/** The hash the app is showing
```

**Edit `src/app/router.ts`** — replace:

```ts
  if (guard && !guard()) {
```

with:

```ts
  if (guard && !guard('navigate')) {
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/app/routerGuard.test.ts`
Expected: PASS (the 4 v1 guard tests + 2 new).

- [ ] **Step 5: New song really starts over**

**Replace `src/app/App.tsx` with:**

```tsx
import { useState, type MouseEvent } from 'react';
import { EditorPage } from './pages/EditorPage';
import { ImportPage } from './pages/ImportPage';
import { PrintPage } from './pages/PrintPage';
import { SongbookPage } from './pages/SongbookPage';
import { confirmLeave, useRoute, type Route } from './router';

interface EditorKey {
  key: number;
  adopt: (id: string) => void;
  /** Start over with a fresh editor (New song while already on #/new). */
  reset: () => void;
}

/**
 * A key for the editor that changes on every visit, except when the editor itself moves from
 * #/new (or a starter song) to #/edit/<id> after its first save: then the same editor stays
 * mounted, keeping undo history, cursor and note length.
 */
function useEditorKey(route: Route): EditorKey {
  const [prev, setPrev] = useState(route);
  const [key, setKey] = useState(0);
  const [adopted, setAdopted] = useState<string | null>(null);
  if (route !== prev) {
    setPrev(route);
    const keep =
      route.name === 'edit' &&
      route.id === adopted &&
      (prev.name === 'new' || prev.name === 'edit');
    if (!keep) setKey((k) => k + 1);
    setAdopted(null);
  }
  return { key, adopt: setAdopted, reset: () => setKey((k) => k + 1) };
}

function RouteView({ route, editor }: { route: Route; editor: EditorKey }) {
  switch (route.name) {
    case 'songbook':
      return <SongbookPage />;
    case 'new':
      return <EditorPage key={editor.key} onSavedAs={editor.adopt} />;
    case 'edit':
      return <EditorPage key={editor.key} songId={route.id} onSavedAs={editor.adopt} />;
    case 'import':
      return <ImportPage />;
    case 'print':
      return <PrintPage key={route.id} songId={route.id} />;
    case 'notFound':
      return (
        <section className="panel">
          <h1>Page not found</h1>
          <p>
            <a href="#/">Back to the songbook</a>
          </p>
        </section>
      );
  }
}

export function App() {
  const route = useRoute();
  const editor = useEditorKey(route);
  const inEditor = route.name === 'new' || route.name === 'edit';

  // The hash doesn't change when you are already on #/new, so start over by hand.
  const onNewSong = (e: MouseEvent<HTMLAnchorElement>) => {
    if (route.name !== 'new') return;
    e.preventDefault();
    if (confirmLeave('new-song')) editor.reset();
  };

  return (
    <div className={inEditor ? 'app app-editor' : 'app'}>
      <header className="app-header no-print">
        <a href="#/" className="brand">
          Note Chomp
        </a>
        <nav>
          <a href="#/new" className="button" onClick={onNewSong}>
            New song
          </a>
          <a href="#/import" className="button secondary">
            Import
          </a>
        </nav>
      </header>
      <main className="app-main">
        <RouteView route={route} editor={editor} />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Guard message, title and time-signature focus**

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
export const LEAVE_UNSAVED_MESSAGE = 'Your song is not saved yet. Leave without saving it?';
```

with:

```tsx
export const LEAVE_UNSAVED_MESSAGE = 'Your song is not saved yet. Leave without saving it?';
export const NEW_SONG_MESSAGE = "Start a new song? Your current one isn't saved.";
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  useEffect(
    () => setNavigationGuard(() => !dirtyRef.current || window.confirm(LEAVE_UNSAVED_MESSAGE)),
    [],
  );
```

with:

```tsx
  useEffect(
    () =>
      setNavigationGuard((reason) => {
        if (!dirtyRef.current) return true;
        const newSong = reason === 'new-song';
        const ok = window.confirm(newSong ? NEW_SONG_MESSAGE : LEAVE_UNSAVED_MESSAGE);
        if (ok && newSong) clearDraft(storage);
        return ok;
      }),
    [storage],
  );
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
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
```

with:

```tsx
          aria-label="Song title"
          placeholder="Name your song"
          maxLength={100}
          value={state.song.title}
          onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
          }}
        />
        <select
          aria-label="Time signature"
          value={state.song.timeSignature}
          onChange={(e) => {
            dispatch({ type: 'setTimeSignature', timeSignature: e.target.value as TimeSignature });
            e.currentTarget.blur();
          }}
        >
```

- [ ] **Step 7: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
```

Expected: all pass, including the v1 "asks before leaving … through a link" test (its message still contains "not saved").

```bash
git add src/app/router.ts src/app/routerGuard.test.ts src/app/App.tsx src/app/pages/EditorPage.tsx
git commit -m "fix(editor): New song on #/new starts fresh; Enter/Esc and time signature hand keys back"
```

---

### Task 20: Draft restore & "Saved!"

**Files:**
- Create: `src/app/draftOffer.ts`
- Modify: `src/app/pages/EditorPage.tsx`
- Test: `src/app/draftOffer.test.ts`

**Interfaces:**
- Consumes: `loadDraft`, `clearDraft` (v1 `src/persistence/draft.ts`, single draft slot); reducer `restore` (Task 7); `useSongLibrary().find(id)` (`{ song, builtin }`); `toast.show(text, 'info')` (Task 12).
- Produces (used by Task 25):
  - `type EditorOpening = 'new' | 'saved' | 'copy'`
  - `draftToOffer(draft: Song | undefined, opened: Song, opening: EditorOpening, isSaved: (id: string) => boolean): Song | undefined` — rules in `00-index.md` Delta 7.
  - `EditorPage` waits for the library on `#/new` too (`Loading…`), passes `opening` to `EditorWorkspace`; shows `<div class="draft-offer alert" role="group" aria-label="Unsaved draft">Pick up where you left off? [Restore] [Discard]</div>` above the sheet; Restore dispatches `restore`, Discard clears the draft; editing first dismisses the offer. `SAVED_MESSAGE = 'Saved!'` is toasted (info) after every successful save.

- [ ] **Step 1: Write the failing test**

**Create `src/app/draftOffer.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import { draftToOffer } from './draftOffer';

const saved = { ...createEmptySong('Mine'), id: 'saved-1', events: [note('C', 4, 'q')] };
const blank = { ...createEmptySong(), id: 'new-1' };
const isSaved = (id: string) => id === saved.id;

describe('draftToOffer', () => {
  it('offers an unsaved song on #/new', () => {
    const draft = { ...createEmptySong('Lost'), id: 'lost-1', events: [note('E', 4, 'q')] };
    expect(draftToOffer(draft, blank, 'new', isSaved)).toBe(draft);
  });

  it('does not offer an empty draft or a saved song’s draft on #/new', () => {
    expect(draftToOffer({ ...blank, id: 'other' }, blank, 'new', isSaved)).toBeUndefined();
    const ofSaved = { ...saved, events: [note('G', 4, 'q')] };
    expect(draftToOffer(ofSaved, blank, 'new', isSaved)).toBeUndefined();
  });

  it('offers a saved song its own changed draft', () => {
    const draft = { ...saved, events: [note('G', 4, 'q')] };
    expect(draftToOffer(draft, saved, 'saved', isSaved)).toBe(draft);
    expect(draftToOffer({ ...saved }, saved, 'saved', isSaved)).toBeUndefined();
    const otherSong = { ...draft, id: 'saved-2' };
    expect(draftToOffer(otherSong, saved, 'saved', isSaved)).toBeUndefined();
  });

  it('never offers a draft over a starter copy, or when there is none', () => {
    const draft = { ...createEmptySong('Lost'), events: [note('E', 4, 'q')] };
    expect(draftToOffer(draft, blank, 'copy', isSaved)).toBeUndefined();
    expect(draftToOffer(undefined, blank, 'new', isSaved)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/app/draftOffer.test.ts`
Expected: FAIL — `Failed to resolve import "./draftOffer"`.

- [ ] **Step 3: Implement the rule**

**Create `src/app/draftOffer.ts`:**

```ts
import type { Song } from '../core/model/types';

/** How the editor was opened: a blank #/new, a saved song of yours, or a fresh copy of a starter song. */
export type EditorOpening = 'new' | 'saved' | 'copy';

const sameMusic = (a: Song, b: Song) =>
  a.title === b.title &&
  a.timeSignature === b.timeSignature &&
  JSON.stringify(a.events) === JSON.stringify(b.events);

/**
 * The draft worth offering back ("Pick up where you left off?"), if any:
 * - on #/new: an unsaved song (its id isn't in your songbook) with at least one note or rest;
 * - on a saved song: that song's own draft, if it differs from what was saved;
 * - never for a fresh starter copy.
 */
export function draftToOffer(
  draft: Song | undefined,
  opened: Song,
  opening: EditorOpening,
  isSaved: (id: string) => boolean,
): Song | undefined {
  if (!draft || opening === 'copy') return undefined;
  if (opening === 'new') {
    return isSaved(draft.id) || draft.events.length === 0 ? undefined : draft;
  }
  return draft.id === opened.id && !sameMusic(draft, opened) ? draft : undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/app/draftOffer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Offer the draft and confirm saves in the editor**

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { clearDraft, saveDraft } from '../../persistence/draft';
```

with:

```tsx
import { clearDraft, loadDraft, saveDraft } from '../../persistence/draft';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { Toast } from '../components/Toast';
```

with:

```tsx
import { Toast } from '../components/Toast';
import { draftToOffer, type EditorOpening } from '../draftOffer';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
export const NEW_SONG_MESSAGE = "Start a new song? Your current one isn't saved.";
```

with:

```tsx
export const NEW_SONG_MESSAGE = "Start a new song? Your current one isn't saved.";
export const SAVED_MESSAGE = 'Saved!';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  const library = useSongLibrary();
  if (songId === undefined)
    return (
      <EditorWorkspace initialSong={createEmptySong()} library={library} onSavedAs={onSavedAs} />
    );
  if (library.status === 'loading') return <p>Loading…</p>;
```

with:

```tsx
  const library = useSongLibrary();
  if (library.status === 'loading') return <p>Loading…</p>;
  if (songId === undefined)
    return (
      <EditorWorkspace
        initialSong={createEmptySong()}
        opening="new"
        library={library}
        onSavedAs={onSavedAs}
      />
    );
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  return <EditorWorkspace initialSong={initial} library={library} onSavedAs={onSavedAs} />;
}

function EditorWorkspace({
  initialSong,
  library,
  onSavedAs,
}: {
  initialSong: Song;
  library: SongLibrary;
```

with:

```tsx
  return (
    <EditorWorkspace
      initialSong={initial}
      opening={entry.builtin ? 'copy' : 'saved'}
      library={library}
      onSavedAs={onSavedAs}
    />
  );
}

function EditorWorkspace({
  initialSong,
  opening,
  library,
  onSavedAs,
}: {
  initialSong: Song;
  opening: EditorOpening;
  library: SongLibrary;
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
```

with:

```tsx
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
  const [offer, setOffer] = useState(() =>
    draftToOffer(
      loadDraft(storage),
      initialSong,
      opening,
      (id) => library.find(id)?.builtin === false,
    ),
  );
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
    if (state.dirty) saveDraft(storage, state.song);
  }, [state.song, state.dirty, storage]);
```

with:

```tsx
    if (state.dirty) saveDraft(storage, state.song);
  }, [state.song, state.dirty, storage]);

  // Editing without answering the draft question means "no thanks" (the draft is now this song).
  useEffect(() => {
    if (state.dirty) setOffer(undefined);
  }, [state.dirty]);
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
      clearDraft(storage);
      return saved;
```

with:

```tsx
      clearDraft(storage);
      setOffer(undefined);
      show(SAVED_MESSAGE, 'info');
      return saved;
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
      <EditorSheet
        song={state.song}
```

with:

```tsx
      {offer && (
        <div className="draft-offer alert" role="group" aria-label="Unsaved draft">
          <span>Pick up where you left off?</span>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'restore', song: offer });
              setOffer(undefined);
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              clearDraft(storage);
              setOffer(undefined);
            }}
          >
            Discard
          </button>
        </div>
      )}

      <EditorSheet
        song={state.song}
```

- [ ] **Step 6: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
```

Expected: all pass. (No v1 e2e test reloads a dirty editor, so the offer never appears in them.)

```bash
git add src/app/draftOffer.ts src/app/draftOffer.test.ts src/app/pages/EditorPage.tsx
git commit -m "feat(editor): offer to restore an unsaved draft; Saved! toast"
```

