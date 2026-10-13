# Phase 6a — Persistence, bundled songs, app shell

### Task 20: Persistence (`src/persistence/`)

**Files:**
- Create: `src/persistence/SongRepository.ts`, `src/persistence/memoryStorage.ts`, `src/persistence/LocalStorageSongRepository.ts`, `src/persistence/draft.ts`
- Test: `src/persistence/LocalStorageSongRepository.test.ts`, `src/persistence/draft.test.ts`

**Interfaces:**
- Consumes: `validateSong`, `ValidationIssue` (Task 6), `Song` (Task 2)
- Produces:
  - `type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `interface SongRepository { list(): Promise<Song[]>; get(id: string): Promise<Song | undefined>; save(song: Song): Promise<Song>; remove(id: string): Promise<void> }` — `save` validates, upserts in place, and resolves with the normalized song
  - `class SongValidationError extends Error { readonly issues: ValidationIssue[] }`
  - `class MemoryStorage implements KeyValueStorage`, `safeLocalStorage(): KeyValueStorage`
  - `class LocalStorageSongRepository implements SongRepository` — `constructor(storage: KeyValueStorage, now?: () => Date)`
  - `STORAGE_KEYS = { songs: 'notechomp:songs:v1', quarantine: 'notechomp:quarantine:v1', draft: 'notechomp:draft:v1' }`
  - `saveDraft(storage, song): void`, `loadDraft(storage): Song | undefined`, `clearDraft(storage): void`

Stored format: `{"version":1,"songs":[...]}`. Every record is validated on read; invalid records (or an unreadable store) are moved to the quarantine key with a timestamp and reason, never thrown. Quarantine write failures are swallowed.

- [ ] **Step 1: Write the failing tests**

`src/persistence/LocalStorageSongRepository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import type { Song } from '../core/model/types';
import { LocalStorageSongRepository } from './LocalStorageSongRepository';
import { MemoryStorage } from './memoryStorage';
import { SongValidationError, STORAGE_KEYS } from './SongRepository';

const NOW = new Date('2026-10-13T12:00:00Z');
const song = (id: string, title = 'Song'): Song => ({ ...createEmptySong(title), id, events: [note('C', 4, 'q')] });

function setup() {
  const storage = new MemoryStorage();
  return { storage, repo: new LocalStorageSongRepository(storage, () => NOW) };
}

describe('LocalStorageSongRepository', () => {
  it('starts empty', async () => {
    expect(await setup().repo.list()).toEqual([]);
  });

  it('saves, gets, and lists songs in insertion order', async () => {
    const { repo } = setup();
    await repo.save(song('a', 'First'));
    await repo.save(song('b', 'Second'));
    expect((await repo.list()).map((s) => s.title)).toEqual(['First', 'Second']);
    expect((await repo.get('b'))?.title).toBe('Second');
    expect(await repo.get('zzz')).toBeUndefined();
  });

  it('updates an existing song in place', async () => {
    const { repo } = setup();
    await repo.save(song('a', 'First'));
    await repo.save(song('b', 'Second'));
    await repo.save(song('a', 'Renamed'));
    expect((await repo.list()).map((s) => s.title)).toEqual(['Renamed', 'Second']);
  });

  it('returns the normalized song from save', async () => {
    const saved = await setup().repo.save(song('a', '  Spaces  '));
    expect(saved.title).toBe('Spaces');
  });

  it('refuses to save an invalid song', async () => {
    const { repo } = setup();
    await expect(repo.save({ ...song('a'), title: '' })).rejects.toBeInstanceOf(SongValidationError);
    expect(await repo.list()).toEqual([]);
  });

  it('removes songs', async () => {
    const { repo } = setup();
    await repo.save(song('a'));
    await repo.remove('a');
    expect(await repo.list()).toEqual([]);
  });

  it('quarantines an unreadable store instead of crashing', async () => {
    const { storage, repo } = setup();
    storage.setItem(STORAGE_KEYS.songs, '{not json');
    expect(await repo.list()).toEqual([]);
    expect(storage.getItem(STORAGE_KEYS.songs)).toBeNull();
    const quarantine = JSON.parse(storage.getItem(STORAGE_KEYS.quarantine) ?? '[]');
    expect(quarantine).toEqual([{ at: NOW.toISOString(), reason: 'unreadable JSON', data: '{not json' }]);
  });

  it('quarantines invalid records and keeps the valid ones', async () => {
    const { storage, repo } = setup();
    const bad = { ...song('bad'), events: [note('F', 3, 'q')] };
    storage.setItem(STORAGE_KEYS.songs, JSON.stringify({ version: 1, songs: [song('ok'), bad] }));
    expect((await repo.list()).map((s) => s.id)).toEqual(['ok']);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.songs) ?? '').songs).toHaveLength(1);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.quarantine) ?? '[]')[0].data.id).toBe('bad');
  });

  it('quarantines an unknown envelope', async () => {
    const { storage, repo } = setup();
    storage.setItem(STORAGE_KEYS.songs, JSON.stringify([song('a')]));
    expect(await repo.list()).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.quarantine) ?? '[]')[0].reason).toBe('unknown format');
  });
});
```

`src/persistence/draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { MemoryStorage } from './memoryStorage';
import { STORAGE_KEYS } from './SongRepository';

describe('draft', () => {
  it('round-trips the song being edited', () => {
    const storage = new MemoryStorage();
    const song = { ...createEmptySong('Draft'), events: [note('E', 4, 'h')] };
    saveDraft(storage, song);
    expect(loadDraft(storage)).toEqual(song);
    clearDraft(storage);
    expect(loadDraft(storage)).toBeUndefined();
  });

  it('ignores a corrupt draft', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.draft, '{"nope":true}');
    expect(loadDraft(storage)).toBeUndefined();
  });

  it('never throws when storage is full', () => {
    const full = { getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(() => saveDraft(full, createEmptySong())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/persistence`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/persistence/SongRepository.ts`:

```ts
import type { ValidationIssue } from '../core/model/schema';
import type { Song } from '../core/model/types';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const STORAGE_KEYS = {
  songs: 'notechomp:songs:v1',
  quarantine: 'notechomp:quarantine:v1',
  draft: 'notechomp:draft:v1',
} as const;

export interface SongRepository {
  list(): Promise<Song[]>;
  get(id: string): Promise<Song | undefined>;
  /** Validates, upserts, and resolves with the normalized song. Rejects with SongValidationError. */
  save(song: Song): Promise<Song>;
  remove(id: string): Promise<void>;
}

export class SongValidationError extends Error {
  override name = 'SongValidationError';
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '));
  }
}
```

`src/persistence/memoryStorage.ts`:

```ts
import type { KeyValueStorage } from './SongRepository';

export class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** localStorage when usable (not blocked/private mode), otherwise an in-memory fallback. */
export function safeLocalStorage(): KeyValueStorage {
  try {
    const storage = window.localStorage;
    const probe = '__notechomp_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStorage();
  }
}
```

`src/persistence/LocalStorageSongRepository.ts`:

```ts
import { validateSong } from '../core/model/schema';
import type { Song } from '../core/model/types';
import { SongValidationError, STORAGE_KEYS, type KeyValueStorage, type SongRepository } from './SongRepository';

interface Envelope {
  version: 1;
  songs: unknown[];
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' && value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { songs?: unknown }).songs)
  );
}

export class LocalStorageSongRepository implements SongRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<Song[]> {
    return this.read();
  }

  async get(id: string): Promise<Song | undefined> {
    return this.read().find((song) => song.id === id);
  }

  async save(song: Song): Promise<Song> {
    const validated = validateSong(song);
    if (!validated.ok) throw new SongValidationError(validated.error);
    const songs = this.read();
    const index = songs.findIndex((s) => s.id === validated.value.id);
    if (index === -1) songs.push(validated.value);
    else songs[index] = validated.value;
    this.write(songs);
    return validated.value;
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((song) => song.id !== id));
  }

  private read(): Song[] {
    const raw = this.storage.getItem(STORAGE_KEYS.songs);
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.quarantine(raw, 'unreadable JSON');
      this.storage.removeItem(STORAGE_KEYS.songs);
      return [];
    }
    if (!isEnvelope(parsed)) {
      this.quarantine(parsed, 'unknown format');
      this.storage.removeItem(STORAGE_KEYS.songs);
      return [];
    }
    const songs: Song[] = [];
    let dropped = false;
    for (const entry of parsed.songs) {
      const validated = validateSong(entry);
      if (validated.ok) songs.push(validated.value);
      else {
        this.quarantine(entry, validated.error.map((issue) => issue.message).join(' '));
        dropped = true;
      }
    }
    if (dropped) this.write(songs);
    return songs;
  }

  private write(songs: Song[]): void {
    const envelope: Envelope = { version: 1, songs };
    this.storage.setItem(STORAGE_KEYS.songs, JSON.stringify(envelope));
  }

  private quarantine(data: unknown, reason: string): void {
    try {
      const existingRaw = this.storage.getItem(STORAGE_KEYS.quarantine);
      const existing: unknown = existingRaw ? JSON.parse(existingRaw) : [];
      const list = Array.isArray(existing) ? existing : [];
      list.push({ at: this.now().toISOString(), reason, data });
      this.storage.setItem(STORAGE_KEYS.quarantine, JSON.stringify(list));
    } catch {
      // Quarantine is best-effort; never let it break loading.
    }
  }
}
```

`src/persistence/draft.ts`:

```ts
import { validateSong } from '../core/model/schema';
import type { Song } from '../core/model/types';
import { STORAGE_KEYS, type KeyValueStorage } from './SongRepository';

export function saveDraft(storage: KeyValueStorage, song: Song): void {
  try {
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify(song));
  } catch {
    // Drafts are best-effort crash insurance.
  }
}

export function loadDraft(storage: KeyValueStorage): Song | undefined {
  try {
    const raw = storage.getItem(STORAGE_KEYS.draft);
    if (!raw) return undefined;
    const validated = validateSong(JSON.parse(raw));
    return validated.ok ? validated.value : undefined;
  } catch {
    return undefined;
  }
}

export function clearDraft(storage: KeyValueStorage): void {
  try {
    storage.removeItem(STORAGE_KEYS.draft);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/persistence`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence && git commit -m "feat(persistence): validated, quarantining localStorage song repository and drafts"
```

---

### Task 21: Bundled songs + layout regression snapshots

**Files:**
- Create: `src/songs/*.abc` (8 files below), `src/songs/index.ts`
- Test: `src/songs/songs.test.ts` (creates `src/songs/__snapshots__/songs.test.ts.snap` on first run)

**Interfaces:**
- Consumes: `parseAbc` (Task 17), `layoutSong`, `DEFAULT_RENDER_OPTIONS`, `STAFF_SIZES` (Task 11)
- Produces:
  - `BUNDLED_SONGS: Song[]` — sorted by filename, ids `builtin-<filename-without-.abc>`
  - `isBuiltinId(id: string): boolean`

Adding a new starter melody = adding one `.abc` file here. The test suite fails if any bundled file doesn't import cleanly.

- [ ] **Step 1: Add the ABC files**

`src/songs/hot-cross-buns.abc`:

```
X:1
T:Hot Cross Buns
M:4/4
L:1/4
K:C
E D C2 | E D C2 | C/2 C/2 C/2 C/2 D/2 D/2 D/2 D/2 | E D C2 |]
```

`src/songs/mary-had-a-little-lamb.abc`:

```
X:1
T:Mary Had a Little Lamb
M:4/4
L:1/4
K:C
E D C D | E E E2 | D D D2 | E G G2 |
E D C D | E E E E | D D E D | C4 |]
```

`src/songs/twinkle-twinkle.abc`:

```
X:1
T:Twinkle Twinkle Little Star
M:4/4
L:1/4
K:C
C C G G | A A G2 | F F E E | D D C2 |
G G F F | E E D2 | G G F F | E E D2 |
C C G G | A A G2 | F F E E | D D C2 |]
```

`src/songs/ode-to-joy.abc`:

```
X:1
T:Ode to Joy
M:4/4
L:1/4
K:C
E E F G | G F E D | C C D E | E3/2 D/2 D2 |
E E F G | G F E D | C C D E | D3/2 C/2 C2 |]
```

`src/songs/jingle-bells.abc`:

```
X:1
T:Jingle Bells
M:4/4
L:1/4
K:C
E E E2 | E E E2 | E G C3/2 D/2 | E4 |
F F F3/2 F/2 | F E E E/2 E/2 | E D D E | D2 G2 |
E E E2 | E E E2 | E G C3/2 D/2 | E4 |
F F F3/2 F/2 | F E E E/2 E/2 | G G F D | C4 |]
```

`src/songs/london-bridge.abc`:

```
X:1
T:London Bridge
M:4/4
L:1/4
K:C
G3/2 A/2 G F | E F G2 | D E F2 | E F G2 |
G3/2 A/2 G F | E F G2 | D2 G E | C4 |]
```

`src/songs/au-clair-de-la-lune.abc`:

```
X:1
T:Au Clair de la Lune
M:4/4
L:1/4
K:C
C C C D | E2 D2 | C E D D | C4 |
C C C D | E2 D2 | C E D D | C4 |]
```

`src/songs/old-macdonald.abc`:

```
X:1
T:Old MacDonald
M:4/4
L:1/4
K:C
C C C G, | A, A, G,2 | E E D D | C3 G, |
C C C G, | A, A, G,2 | E E D D | C4 |]
```

- [ ] **Step 2: Write the failing test**

`src/songs/songs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_RENDER_OPTIONS, layoutSong, STAFF_SIZES, type LayoutResult } from '../core/layout';
import { BUNDLED_SONGS, isBuiltinId } from './index';

/** Compact, reviewable digest of a layout — catches geometry regressions without megabyte snapshots. */
function digest(result: LayoutResult) {
  const r = (n: number) => Math.round(n * 100) / 100;
  return result.pages.map((page) => ({
    pageItems: page.items.map((i) => i.kind),
    systems: page.systems.map((system) => ({
      firstMeasure: system.firstMeasure,
      staffTop: r(system.staffTop),
      fruit: system.items.flatMap((i) => (i.kind === 'fruit' ? [`${i.pitch}${i.octave}@${r(i.x)},${r(i.y)}${i.hollow ? 'o' : ''}`] : [])),
      beams: system.items.filter((i) => i.kind === 'beam').length,
      ledgers: system.items.filter((i) => i.kind === 'ledger').length,
      clefs: system.items.filter((i) => i.kind === 'clef').length,
      /** Note names and measure numbers, in drawing order. */
      labels: system.items.flatMap((i) => (i.kind === 'label' ? [i.text] : [])),
    })),
  }));
}

describe('bundled songs', () => {
  it('ships the eight starter songs', () => {
    expect(BUNDLED_SONGS.map((s) => s.title)).toEqual([
      'Au Clair de la Lune', 'Hot Cross Buns', 'Jingle Bells', 'London Bridge',
      'Mary Had a Little Lamb', 'Ode to Joy', 'Old MacDonald', 'Twinkle Twinkle Little Star',
    ]);
  });

  it('uses stable builtin ids', () => {
    expect(BUNDLED_SONGS.find((s) => s.title === 'Hot Cross Buns')?.id).toBe('builtin-hot-cross-buns');
    expect(BUNDLED_SONGS.every((s) => isBuiltinId(s.id))).toBe(true);
    expect(isBuiltinId('3f2a…')).toBe(false);
  });

  it('fits every song on two Letter pages at Large (Jingle Bells, the longest, on three)', () => {
    for (const song of BUNDLED_SONGS) {
      const limit = song.title === 'Jingle Bells' ? 3 : 2;
      expect(layoutSong(song).pages.length, song.title).toBeLessThanOrEqual(limit);
    }
  });

  for (const song of BUNDLED_SONGS) {
    it(`${song.title} lays out the same as last time (default)`, () => {
      expect(digest(layoutSong(song))).toMatchSnapshot();
    });
    it(`${song.title} lays out the same as last time (jumbo, solfège, size-by-duration)`, () => {
      const options = {
        ...DEFAULT_RENDER_OPTIONS, staffSpaceMm: STAFF_SIZES.jumbo, noteLabels: 'solfege' as const, sizeByDuration: true,
      };
      expect(digest(layoutSong(song, options))).toMatchSnapshot();
    });
    it(`${song.title} lays out the same as last time (A4, treble clef, measure numbers, no legend)`, () => {
      const options = {
        ...DEFAULT_RENDER_OPTIONS, paper: 'a4' as const, showTrebleClef: true, showMeasureNumbers: true, showLegend: false,
      };
      expect(digest(layoutSong(song, options))).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/songs`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 4: Implement `src/songs/index.ts`**

```ts
import type { Song } from '../core/model/types';
import { parseAbc } from '../formats/abc/parseAbc';

const sources = import.meta.glob<string>('./*.abc', { query: '?raw', import: 'default', eager: true });

const BUILTIN_PREFIX = 'builtin-';

export const isBuiltinId = (id: string): boolean => id.startsWith(BUILTIN_PREFIX);

export const BUNDLED_SONGS: Song[] = Object.keys(sources)
  .sort()
  .map((path) => {
    const result = parseAbc(sources[path]);
    if (!result.ok) {
      throw new Error(`Bundled song ${path} is invalid: ${result.errors.map((e) => e.message).join('; ')}`);
    }
    const slug = path.replace(/^\.\//, '').replace(/\.abc$/, '');
    return { ...result.song, id: `${BUILTIN_PREFIX}${slug}` };
  });
```

- [ ] **Step 5: Run to verify it passes and review the snapshot**

Run: `npx vitest run src/songs`
Expected: PASS; a new snapshot file is written (run without `CI=true` — Vitest does not write new snapshots in CI, so the `.snap` file must be committed). Expect 24 snapshots (8 songs × 3 option sets). Open `src/songs/__snapshots__/songs.test.ts.snap` and sanity-check one entry: Hot Cross Buns default is 1 page with 3 systems, `firstMeasure` 1, 3, 4; system 2 has `beams: 4`; C4 fruit have one ledger each (system ledger counts 2, 4, 1). At Large on Letter, Jingle Bells takes 3 pages (systems start at measures 1, 3, 5 / 7, 9, 11 / 13, 15) and every other song takes 2 (Hot Cross Buns 1).

- [ ] **Step 6: Commit**

```bash
git add src/songs && git commit -m "feat(songs): eight bundled ABC starter songs with layout regression digests"
```

---

### Task 22: App shell — router, services, library hook, error boundary, e2e harness

**Files:**
- Create: `src/core/text.ts`, `src/core/text.test.ts`, `src/app/router.ts`, `src/app/router.test.ts`, `src/app/services.tsx`, `src/app/useSongLibrary.ts`, `src/app/download.ts`, `src/app/components/ErrorBoundary.tsx`, `src/app/styles.css`, `src/app/pages/SongbookPage.tsx` (stub), `src/app/pages/EditorPage.tsx` (stub), `src/app/pages/ImportPage.tsx` (stub), `src/app/pages/PrintPage.tsx` (stub), `e2e/smoke.spec.ts`
- Modify: `src/app/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `SongRepository`, `KeyValueStorage`, `LocalStorageSongRepository`, `safeLocalStorage`, `loadDraft` (Task 20); `BUNDLED_SONGS` (Task 21); `serializeSong`, `NOTECHOMP_EXTENSION` (Task 16)
- Produces:
  - `slugify(title: string): string` (core)
  - `type Route = { name: 'songbook' } | { name: 'new' } | { name: 'edit'; id: string } | { name: 'import' } | { name: 'print'; id: string } | { name: 'notFound' }`
  - `parseHash(hash: string): Route`, `routeToHash(route: Route): string`, `navigate(route: Route): void`, `useRoute(): Route`
  - `interface Services { repository: SongRepository; storage: KeyValueStorage }`, `ServicesProvider`, `useServices(): Services`
  - `interface LibraryEntry { song: Song; builtin: boolean }`
  - `interface SongLibrary { status: 'loading' | 'ready' | 'error'; error: string | null; builtin: Song[]; user: Song[]; find(id: string): LibraryEntry | undefined; save(song: Song): Promise<Song>; remove(id: string): Promise<void> }`
  - `useSongLibrary(): SongLibrary`, `messageOf(e: unknown): string`
  - `downloadBlob(filename: string, blob: Blob): void`, `downloadText(filename: string, text: string, type: string): void`
  - `ErrorBoundary` (props `{ storage: KeyValueStorage; children: ReactNode }`)
  - Stub pages with the final signatures: `SongbookPage()`, `EditorPage({ songId }: { songId?: string })`, `ImportPage()`, `PrintPage({ songId }: { songId: string })`

- [ ] **Step 1: Write the failing unit tests**

`src/core/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { slugify } from './text';

describe('slugify', () => {
  it('makes safe, readable file names', () => {
    expect(slugify('Twinkle Twinkle Little Star')).toBe('twinkle-twinkle-little-star');
    expect(slugify("  Au Clair de la Lune (my copy)! ")).toBe('au-clair-de-la-lune-my-copy');
    expect(slugify('Ödé tô Jöy')).toBe('ode-to-joy');
    expect(slugify('!!!')).toBe('song');
  });
});
```

`src/app/router.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash, type Route } from './router';

describe('router', () => {
  it.each<[string, Route]>([
    ['', { name: 'songbook' }],
    ['#/', { name: 'songbook' }],
    ['#/new', { name: 'new' }],
    ['#/import', { name: 'import' }],
    ['#/edit/abc-123', { name: 'edit', id: 'abc-123' }],
    ['#/print/builtin-ode-to-joy', { name: 'print', id: 'builtin-ode-to-joy' }],
    ['#/edit', { name: 'notFound' }],
    ['#/whatever/else/here', { name: 'notFound' }],
    ['#/edit/%E0%A4%A', { name: 'notFound' }],
  ])('parses %s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it('round-trips routes with ids that need encoding', () => {
    const route: Route = { name: 'edit', id: 'a b/c' };
    expect(parseHash(routeToHash(route))).toEqual(route);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/core/text.test.ts src/app`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `slugify` and the router**

`src/core/text.ts`:

```ts
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'song';
}
```

`src/app/router.ts`:

```ts
import { useMemo, useSyncExternalStore } from 'react';

export type Route =
  | { name: 'songbook' }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'import' }
  | { name: 'print'; id: string }
  | { name: 'notFound' };

export function parseHash(hash: string): Route {
  let parts: string[];
  try {
    parts = hash.replace(/^#/, '').split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { name: 'notFound' };
  }
  const [head, id] = parts;
  if (parts.length === 0) return { name: 'songbook' };
  if (parts.length === 1 && head === 'new') return { name: 'new' };
  if (parts.length === 1 && head === 'import') return { name: 'import' };
  if (parts.length === 2 && head === 'edit' && id) return { name: 'edit', id };
  if (parts.length === 2 && head === 'print' && id) return { name: 'print', id };
  return { name: 'notFound' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'songbook':
    case 'notFound':
      return '#/';
    case 'new':
      return '#/new';
    case 'import':
      return '#/import';
    case 'edit':
      return `#/edit/${encodeURIComponent(route.id)}`;
    case 'print':
      return `#/print/${encodeURIComponent(route.id)}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parseHash(hash), [hash]);
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npx vitest run src/core/text.test.ts src/app`
Expected: PASS.

- [ ] **Step 5: Services, library hook, downloads, error boundary**

`src/app/services.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { KeyValueStorage, SongRepository } from '../persistence/SongRepository';

export interface Services {
  repository: SongRepository;
  storage: KeyValueStorage;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
```

`src/app/useSongLibrary.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { Song } from '../core/model/types';
import { BUNDLED_SONGS } from '../songs';
import { useServices } from './services';

export interface LibraryEntry {
  song: Song;
  builtin: boolean;
}

export interface SongLibrary {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  builtin: Song[];
  user: Song[];
  find(id: string): LibraryEntry | undefined;
  save(song: Song): Promise<Song>;
  remove(id: string): Promise<void>;
}

export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function useSongLibrary(): SongLibrary {
  const { repository } = useServices();
  const [user, setUser] = useState<Song[]>([]);
  const [status, setStatus] = useState<SongLibrary['status']>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository.list().then(
      (songs) => {
        if (cancelled) return;
        setUser(songs);
        setStatus('ready');
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(messageOf(e));
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const save = useCallback(
    async (song: Song) => {
      const saved = await repository.save(song);
      setUser(await repository.list());
      return saved;
    },
    [repository],
  );

  const remove = useCallback(
    async (id: string) => {
      await repository.remove(id);
      setUser(await repository.list());
    },
    [repository],
  );

  const find = useCallback(
    (id: string): LibraryEntry | undefined => {
      const builtin = BUNDLED_SONGS.find((s) => s.id === id);
      if (builtin) return { song: builtin, builtin: true };
      const mine = user.find((s) => s.id === id);
      return mine ? { song: mine, builtin: false } : undefined;
    },
    [user],
  );

  return { status, error, builtin: BUNDLED_SONGS, user, find, save, remove };
}
```

`src/app/download.ts`:

```ts
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, type: string): void {
  downloadBlob(filename, new Blob([text], { type }));
}
```

`src/app/components/ErrorBoundary.tsx`:

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { slugify } from '../../core/text';
import { NOTECHOMP_EXTENSION, serializeSong } from '../../formats/notechomp/notechomp';
import { loadDraft } from '../../persistence/draft';
import type { KeyValueStorage } from '../../persistence/SongRepository';
import { downloadText } from '../download';

interface Props {
  storage: KeyValueStorage;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Note Chomp crashed', error, info.componentStack);
  }

  private downloadDraft = () => {
    const draft = loadDraft(this.props.storage);
    if (draft) downloadText(`${slugify(draft.title)}${NOTECHOMP_EXTENSION}`, serializeSong(draft), 'application/json');
  };

  private goHome = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  override render() {
    if (!this.state.error) return this.props.children;
    const hasDraft = loadDraft(this.props.storage) !== undefined;
    return (
      <main className="crash" role="alert">
        <h1>Oops! The monster has a tummy ache.</h1>
        <p>Something went wrong. Your saved songs are safe.</p>
        {hasDraft && (
          <button type="button" onClick={this.downloadDraft}>
            Download the song you were editing
          </button>
        )}
        <button type="button" onClick={this.goHome}>
          Back to the songbook
        </button>
      </main>
    );
  }
}
```

- [ ] **Step 6: Stub pages, App, main, styles**

Stub pages (each replaced by its own task — keep these exact signatures):

`src/app/pages/SongbookPage.tsx`:

```tsx
export function SongbookPage() {
  return <h1>Songbook</h1>;
}
```

`src/app/pages/EditorPage.tsx`:

```tsx
export function EditorPage({ songId }: { songId?: string }) {
  return <h1>Editor {songId}</h1>;
}
```

`src/app/pages/ImportPage.tsx`:

```tsx
export function ImportPage() {
  return <h1>Import</h1>;
}
```

`src/app/pages/PrintPage.tsx`:

```tsx
export function PrintPage({ songId }: { songId: string }) {
  return <h1>Print {songId}</h1>;
}
```

`src/app/App.tsx`:

```tsx
import { EditorPage } from './pages/EditorPage';
import { ImportPage } from './pages/ImportPage';
import { PrintPage } from './pages/PrintPage';
import { SongbookPage } from './pages/SongbookPage';
import { useRoute, type Route } from './router';

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'songbook':
      return <SongbookPage />;
    case 'new':
      return <EditorPage key="new" />;
    case 'edit':
      return <EditorPage key={route.id} songId={route.id} />;
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
  return (
    <div className="app">
      <header className="app-header no-print">
        <a href="#/" className="brand">
          Note Chomp
        </a>
        <nav>
          <a href="#/new" className="button">New song</a>
          <a href="#/import" className="button secondary">Import</a>
        </nav>
      </header>
      <main className="app-main">
        <RouteView route={route} />
      </main>
    </div>
  );
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { ServicesProvider, type Services } from './app/services';
import './app/styles.css';
import { LocalStorageSongRepository } from './persistence/LocalStorageSongRepository';
import { safeLocalStorage } from './persistence/memoryStorage';

const storage = safeLocalStorage();
const services: Services = { repository: new LocalStorageSongRepository(storage), storage };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <ErrorBoundary storage={storage}>
        <App />
      </ErrorBoundary>
    </ServicesProvider>
  </StrictMode>,
);
```

`src/app/styles.css`:

```css
:root {
  --ink: #37474f;
  --muted: #607d8b;
  --paper: #ffffff;
  --bg: #fff8ec;
  --accent: #5c6bc0;
  --accent-dark: #283593;
  --danger: #c62828;
  --radius: 16px;
  font-family: ui-rounded, 'Nunito', 'Segoe UI', system-ui, sans-serif;
  color: var(--ink);
  background: var(--bg);
}

* { box-sizing: border-box; }
body { margin: 0; }

.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; background: var(--paper); box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}
.brand { font-size: 1.6rem; font-weight: 800; color: var(--accent-dark); text-decoration: none; }
.app-header nav { display: flex; gap: 12px; }
.app-main { max-width: 1200px; margin: 0 auto; padding: 24px; }

button, .button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 8px 18px; border: 0; border-radius: 999px;
  background: var(--accent); color: #fff; font: inherit; font-weight: 700;
  text-decoration: none; cursor: pointer;
}
button:hover, .button:hover { background: var(--accent-dark); }
button:disabled { opacity: 0.5; cursor: default; }
button.secondary, .button.secondary { background: #e8eaf6; color: var(--accent-dark); }
button.danger { background: #ffebee; color: var(--danger); }
button[aria-pressed='true'] { outline: 3px solid #ffca28; }

.panel { background: var(--paper); border-radius: var(--radius); padding: 20px; box-shadow: 0 2px 10px rgb(0 0 0 / 6%); }
.alert { background: #fff3e0; border: 2px solid #ffb74d; border-radius: 12px; padding: 12px 16px; }
.alert.error { background: #ffebee; border-color: #e57373; }
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
input[type='text'], select, textarea {
  font: inherit; padding: 8px 12px; border: 2px solid #cfd8dc; border-radius: 12px; background: #fff;
}

.song-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.song-card { display: flex; flex-direction: column; gap: 10px; }
.song-card h3 { margin: 0; }
.song-card .actions { display: flex; flex-wrap: wrap; gap: 8px; }

.song-pages { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.page-svg { width: 100%; max-width: 900px; height: auto; background: #fff; box-shadow: 0 4px 16px rgb(0 0 0 / 12%); border-radius: 4px; }

.fruit-keyboard { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
.fruit-key { flex-direction: column; min-height: 88px; border-radius: var(--radius); background: #fff; color: var(--ink); border: 3px solid #eceff1; }
.fruit-key:hover { background: #f5f5f5; border-color: #b0bec5; }
.fruit-key svg { width: 48px; height: 48px; }

.crash { max-width: 600px; margin: 80px auto; text-align: center; display: grid; gap: 12px; }

@media print {
  @page { margin: 0; }
  body, .app-main { background: #fff; margin: 0; padding: 0; max-width: none; }
  .no-print { display: none !important; }
  .song-pages { gap: 0; }
  .page-svg { width: 100%; max-width: none; box-shadow: none; border-radius: 0; break-after: page; }
}
```

- [ ] **Step 7: First e2e specs (smoke test)**

`playwright.config.ts` already exists (Task 1) — it serves the app on port 5179 via `npm run dev` and runs specs in `e2e/`. This step adds the first specs, so `test:e2e` now runs real tests instead of passing with none.

`e2e/smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('loads the app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Note Chomp' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New song' })).toBeVisible();
});

test('shows a friendly not-found page', async ({ page }) => {
  await page.goto('/#/nope/nope/nope');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
```

- [ ] **Step 8: Run all checks**

```bash
npx playwright install chromium
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

Expected: all pass; 2 e2e tests pass. (On this machine run the Playwright commands with the Bash sandbox disabled — Chromium is killed inside it.)

- [ ] **Step 9: Commit**

```bash
git add src e2e && git commit -m "feat(app): shell with hash router, services, song library, crash rescue, e2e harness"
```
