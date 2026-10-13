# Phase 7b — Quick fixes: imports & numbered copies (Tasks 21–22)

Spec §6. Their end-to-end tests are in Task 25.

### Task 21: Import fixes

**Files:**
- Modify: `src/formats/abc/parseAbc.ts`, `src/app/pages/ImportPage.tsx`
- Test: `src/formats/abc/parseAbcText.test.ts` (new)

**Interfaces:**
- Consumes: `importFailure(messages)` (`src/formats/types.ts`); the ABC tokenizer's two "Skipped an unrecognized symbol…" warning sites.
- Produces (used by Task 25):
  - `NOT_MUSIC_ERROR = 'No notes were found. Is this ABC, MusicXML or a Note Chomp file?'`
  - `skippedWarning(count: number): string` — `"Skipped 1 character we didn't understand."` / `"Skipped 14 characters we didn't understand."`
  - `parseAbc`: counts skipped characters instead of warning per character; if any were skipped and (no `K:` field or more skipped than notes) → `{ ok: false, errors: [{ message: NOT_MUSIC_ERROR }] }`; otherwise one collapsed warning.
  - `ImportPage`: editing the text clears the previous result and save error (no stale Save buttons).

- [ ] **Step 1: Write the failing test**

**Create `src/formats/abc/parseAbcText.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { NOT_MUSIC_ERROR, parseAbc, skippedWarning } from './parseAbc';

const tune = (body: string) => `X:1\nT:Test Tune\nM:4/4\nL:1/4\nK:C\n${body}\n`;

describe('parseAbc with text that is not music', () => {
  it.each([
    'hello world',
    'Shopping list: milk, eggs, bread',
    'Dear Grandma, thank you for the cake!',
  ])('rejects %j instead of importing a few stray letters', (text) => {
    expect(parseAbc(text)).toEqual({ ok: false, errors: [{ message: NOT_MUSIC_ERROR }] });
  });

  it('rejects a tune whose body is mostly unreadable', () => {
    expect(parseAbc(tune('hello there, my friend'))).toEqual({
      ok: false,
      errors: [{ message: NOT_MUSIC_ERROR }],
    });
  });

  it('still imports a headerless body that reads cleanly', () => {
    const result = parseAbc('C D E F | G4 |]');
    expect(result.ok).toBe(true);
  });
});

describe('unrecognized symbols', () => {
  it('collapse into one warning with a count', () => {
    const result = parseAbc(tune('C D # E F | & G4 |]'));
    if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));
    expect(result.warnings).toEqual([{ message: "Skipped 2 characters we didn't understand." }]);
  });

  it('says "character" for one', () => {
    expect(skippedWarning(1)).toBe("Skipped 1 character we didn't understand.");
    expect(skippedWarning(14)).toBe("Skipped 14 characters we didn't understand.");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/formats/abc/parseAbcText.test.ts`
Expected: FAIL — `does not provide an export named 'NOT_MUSIC_ERROR'`.

- [ ] **Step 3: Implement in the ABC importer**

**Edit `src/formats/abc/parseAbc.ts`** — replace:

```ts
import type { ImportResult } from '../types';
```

with:

```ts
import { importFailure, type ImportResult } from '../types';
```

**Edit `src/formats/abc/parseAbc.ts`** — replace:

```ts
interface Header {
  title?: string;
  meter: TimeSignature;
  unitUnits?: number;
  voices: Set<string>;
}
```

with:

```ts
interface Header {
  title?: string;
  meter: TimeSignature;
  unitUnits?: number;
  voices: Set<string>;
  /** A K: field was seen (every real ABC tune has one). */
  sawKey: boolean;
  /** Characters in the tune body we couldn't read. */
  skipped: number;
}

export const NOT_MUSIC_ERROR = 'No notes were found. Is this ABC, MusicXML or a Note Chomp file?';

export function skippedWarning(count: number): string {
  return `Skipped ${count} ${count === 1 ? 'character' : 'characters'} we didn't understand.`;
}
```

**Edit `src/formats/abc/parseAbc.ts`** — replace:

```ts
    case 'K':
      if (!isSupportedKey(value))
```

with:

```ts
    case 'K':
      header.sawKey = true;
      if (!isSupportedKey(value))
```

**Edit `src/formats/abc/parseAbc.ts`** — replace:

```ts
  const header: Header = { meter: '4/4', voices: new Set() };
```

with:

```ts
  const header: Header = { meter: '4/4', voices: new Set(), sawKey: false, skipped: 0 };
```

**Edit `src/formats/abc/parseAbc.ts`** — replace:

```ts
  const events = tokenizeBody(body.join(' '), header, issues);
```

with:

```ts
  const events = tokenizeBody(body.join(' '), header, issues);
  if (header.skipped > 0) {
    // Plain text (a shopping list, a sentence) is mostly letters we can't read, plus a few a–g.
    const notes = events.filter((e) => e.kind === 'note').length;
    if (!header.sawKey || header.skipped > notes) return importFailure([NOT_MUSIC_ERROR]);
    issues.warn(skippedWarning(header.skipped));
  }
```

**Edit `src/formats/abc/parseAbc.ts`** — replace:

```ts
        issues.warn(`Skipped an unrecognized symbol in measure ${measure}.`);
        continue;
```

with:

```ts
        header.skipped++;
        continue;
```

**Edit `src/formats/abc/parseAbc.ts`** — replace:

```ts
    issues.warn(`Skipped an unrecognized symbol "${ch}" in measure ${measure}.`);
    i++;
```

with:

```ts
    header.skipped++;
    i++;
```

- [ ] **Step 4: Run the format tests to verify they pass**

Run: `timeout 120 npx vitest run src/formats`
Expected: PASS — the 5 new tests and every existing importer test (none of them relied on the per-character warning).

- [ ] **Step 5: Clear a stale import result**

**Edit `src/app/pages/ImportPage.tsx`** — replace:

```tsx
          onChange={(e) => setText(e.target.value)}
```

with:

```tsx
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
            setSaveError(null);
          }}
```

- [ ] **Step 6: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
git add src/formats/abc/parseAbc.ts src/formats/abc/parseAbcText.test.ts src/app/pages/ImportPage.tsx
git commit -m "fix(import): reject text that isn't music, collapse skipped-character warnings, clear stale results"
```

---

### Task 22: Numbered copies

**Files:**
- Modify: `src/core/text.ts` (append), `src/app/pages/SongbookPage.tsx`, `src/app/pages/EditorPage.tsx`
- Test: `src/core/text.test.ts` (import line + new `describe`)

**Interfaces:**
- Consumes: `useSongLibrary().user` (saved songs).
- Produces (used by Task 25): `copyTitle(title: string, taken: readonly string[]): string` — `"<title> (my copy)"`, or `"(my copy 2)"`, `"(my copy 3)"`, … (first free number). Used by Songbook "Make a copy" and by opening a starter song in the editor.

- [ ] **Step 1: Write the failing test**

**Edit `src/core/text.test.ts`** — replace:

```ts
import { slugify } from './text';
```

with:

```ts
import { copyTitle, slugify } from './text';
```

**Append to `src/core/text.test.ts`:**

```ts
describe('copyTitle', () => {
  it('adds "(my copy)" when the name is free', () => {
    expect(copyTitle('Ode to Joy', [])).toBe('Ode to Joy (my copy)');
    expect(copyTitle('Ode to Joy', ['Ode to Joy'])).toBe('Ode to Joy (my copy)');
  });
  it('numbers further copies', () => {
    expect(copyTitle('Ode to Joy', ['Ode to Joy (my copy)'])).toBe('Ode to Joy (my copy 2)');
    expect(
      copyTitle('Ode to Joy', [
        'Ode to Joy (my copy)',
        'Ode to Joy (my copy 2)',
        'Ode to Joy (my copy 4)',
      ]),
    ).toBe('Ode to Joy (my copy 3)');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/text.test.ts`
Expected: FAIL — `does not provide an export named 'copyTitle'`.

- [ ] **Step 3: Implement**

**Append to `src/core/text.ts`:**

```ts
/** "<title> (my copy)", or "(my copy 2)", "(my copy 3)", … when that name is taken. */
export function copyTitle(title: string, taken: readonly string[]): string {
  const names = new Set(taken);
  const first = `${title} (my copy)`;
  if (!names.has(first)) return first;
  for (let n = 2; ; n++) {
    const candidate = `${title} (my copy ${n})`;
    if (!names.has(candidate)) return candidate;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/text.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it for both kinds of copy**

**Edit `src/app/pages/SongbookPage.tsx`** — replace:

```tsx
import { slugify } from '../../core/text';
```

with:

```tsx
import { copyTitle, slugify } from '../../core/text';
```

**Edit `src/app/pages/SongbookPage.tsx`** — replace:

```tsx
        title: `${song.title} (my copy)`,
```

with:

```tsx
        title: copyTitle(
          song.title,
          library.user.map((s) => s.title),
        ),
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
import { isInRange, toNoteName } from '../../core/theory/pitch';
```

with:

```tsx
import { isInRange, toNoteName } from '../../core/theory/pitch';
import { copyTitle } from '../../core/text';
```

**Edit `src/app/pages/EditorPage.tsx`** — replace:

```tsx
    ? { ...entry.song, id: newSongId(), title: `${entry.song.title} (my copy)` }
    : entry.song;
```

with:

```tsx
    ? {
        ...entry.song,
        id: newSongId(),
        title: copyTitle(
          entry.song.title,
          library.user.map((s) => s.title),
        ),
      }
    : entry.song;
```

- [ ] **Step 6: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
```

Expected: all pass — v1 tests still see "Hot Cross Buns (my copy)" and "Ode to Joy (my copy)" (first copies keep the old name).

```bash
git add src/core/text.ts src/core/text.test.ts src/app/pages/SongbookPage.tsx src/app/pages/EditorPage.tsx
git commit -m "fix(songbook): number repeated copies instead of duplicating names"
```
