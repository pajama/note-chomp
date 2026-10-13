# Phase 8 — End-to-end specs, docs & final check (Tasks 23–26)

Spec §7. These specs lock in behaviour built in Tasks 14–22, so they are expected to **pass on the first run**. If one fails, do not loosen the assertion: use superpowers:systematic-debugging, fix the app (or a genuinely wrong selector), and say so in the commit message. Run Playwright with the sandbox disabled; port 5179 must be free.

### Task 23: E2E: selection & drag

**Files:**
- Modify: `e2e/fixtures.ts` (append `noteButton`)
- Create: `e2e/selection.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `Page`, `fruits`, `openEditor` (Task 10); note-column names "Note n: …" (Task 13); `data-kind="selection-glow"` / `"cursor"` / `"gap-target"` (Task 13); `data-testid="selection-announcer"` (Task 18); `window.__NOTE_CHOMP_AUDIO_LOG__` (Task 10).
- Produces: `noteButton(page: Page, n: number): Locator` (1-based) — used by Tasks 24–25.

Covers spec §7: click selects (glow + aria), fruit key changes pitch, length button changes duration, Backspace deletes the selection, Esc deselects, ←/→ navigation, ↑/↓ nudge, **mouse drag** up two steps changes E4→G4 (one Undo step), plus gap click → cursor.

- [ ] **Step 1: Add the helper**

**Append to `e2e/fixtures.ts`:**

```ts
/** The note column for event n (1-based), found by its accessible name. */
export const noteButton = (page: Page, n: number) =>
  page.getByRole('button', { name: new RegExp(`^Note ${n}:`) });
```

- [ ] **Step 2: Write the spec**

**Create `e2e/selection.spec.ts`:**

```ts
import { expect, fruits, noteButton, openEditor, test, type Page } from './fixtures';

const glow = (page: Page) => page.locator('[data-kind="selection-glow"]');
const cursor = (page: Page) => page.locator('[data-kind="cursor"]');

test('clicking a note selects it instead of moving the cursor', async ({ page }) => {
  await openEditor(page, 'cde');
  await noteButton(page, 2).click();
  await expect(noteButton(page, 2)).toHaveAccessibleName('Note 2: D, quarter note, selected');
  await expect(glow(page)).toHaveAttribute('data-event-index', '1');
  await expect(cursor(page)).toHaveCount(0);
  await expect(page.getByTestId('selection-announcer')).toHaveText(
    'Selected Note 2: D, quarter note',
  );
});

test('a fruit key or a letter changes the selected note', async ({ page }) => {
  await openEditor(page, 'cde');
  await noteButton(page, 2).click();
  await page.getByRole('button', { name: 'Add G4' }).click();
  await expect(fruits(page)).toHaveCount(3);
  await expect(fruits(page).nth(1)).toHaveAttribute('data-pitch', 'G');
  await page.keyboard.press('a');
  await expect(fruits(page)).toHaveCount(3);
  await expect(fruits(page).nth(1)).toHaveAttribute('data-pitch', 'A');
});

test('a length button changes the selected note', async ({ page }) => {
  await openEditor(page, 'cde');
  await noteButton(page, 1).click();
  await page.getByRole('button', { name: 'Half', exact: true }).click();
  await expect(noteButton(page, 1)).toHaveAccessibleName('Note 1: C, half note, selected');
  await expect(page.getByRole('button', { name: 'Half', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Backspace deletes the selected note and Esc lets go', async ({ page }) => {
  await openEditor(page, 'cde');
  await noteButton(page, 3).click();
  await page.keyboard.press('Backspace');
  await expect(fruits(page)).toHaveCount(2);
  await expect(noteButton(page, 2)).toHaveAccessibleName(/selected$/);
  await page.keyboard.press('Escape');
  await expect(glow(page)).toHaveCount(0);
  await expect(cursor(page)).toHaveCount(1);
});

test('← and → step through gaps and notes', async ({ page }) => {
  await openEditor(page, 'cde');
  await page.keyboard.press('ArrowLeft');
  await expect(glow(page)).toHaveAttribute('data-event-index', '2');
  await page.keyboard.press('ArrowLeft');
  await expect(glow(page)).toHaveCount(0);
  await expect(cursor(page)).toHaveCount(1);
  await page.keyboard.press('ArrowLeft');
  await expect(glow(page)).toHaveAttribute('data-event-index', '1');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(glow(page)).toHaveAttribute('data-event-index', '2');
});

test('↑ and ↓ nudge the selected note; Shift switches octave', async ({ page }) => {
  await openEditor(page, 'c');
  await noteButton(page, 1).click();
  await page.keyboard.press('ArrowUp');
  await expect(fruits(page).first()).toHaveAttribute('data-pitch', 'D');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(noteButton(page, 1)).toHaveAccessibleName('Note 1: B, quarter note, selected');
  await page.keyboard.press('Shift+ArrowUp');
  await expect(page.getByText('High notes')).toBeVisible();
  await expect(fruits(page).first()).toHaveAttribute('data-pitch', 'B');
});

test('dragging a selected note up two steps turns E4 into G4', async ({ page }) => {
  await openEditor(page, 'e');
  const box = await noteButton(page, 1).boundingBox();
  if (!box) throw new Error('note target not visible');
  const space = box.height / 11; // a note column is 11 staff spaces tall
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - space / 2, { steps: 4 });
  await page.mouse.move(x, y - space, { steps: 4 });
  await page.mouse.up();
  await expect(fruits(page).first()).toHaveAttribute('data-pitch', 'G');
  await expect(noteButton(page, 1)).toHaveAccessibleName('Note 1: G, quarter note, selected');

  const previews = await page.evaluate(() =>
    (window.__NOTE_CHOMP_AUDIO_LOG__ ?? []).flatMap((c) => (c.kind === 'preview' ? [c.note] : [])),
  );
  expect(previews).toEqual(['E4', 'E4', 'F4', 'G4']);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(fruits(page).first()).toHaveAttribute('data-pitch', 'E');
});

test('clicking between notes places the cursor there', async ({ page }) => {
  await openEditor(page, 'ce');
  const gap = page.locator('[data-kind="gap-target"][data-gap-index="1"]');
  await gap.click();
  await page.keyboard.press('d');
  await expect(fruits(page).nth(1)).toHaveAttribute('data-pitch', 'D');
});
```

(The drag test derives one staff space from the note column's height — 11 spaces — so it works at any zoom. Expected previews: `E4` from typing `e`, `E4` from the press, then `F4`, `G4` from the two drag steps.)

- [ ] **Step 3: Run it**

Run (sandbox disabled): `timeout 300 npx playwright test e2e/selection.spec.ts --repeat-each=3`
Expected: `24 passed` (8 tests × 3), no flakes.

- [ ] **Step 4: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled → 33 passed
git add e2e/fixtures.ts e2e/selection.spec.ts
git commit -m "test(e2e): select, change, nudge, navigate, delete and drag notes"
```

---

### Task 24: E2E: playback

**Files:**
- Create: `e2e/playback.spec.ts`

**Interfaces:**
- Consumes: fixtures (Tasks 10, 23); Play/Stop buttons (`aria-label` "Play"/"Stop") and the `Tempo` slider (Task 12); `data-kind="playing-halo"` (Task 13); fake audio log entries `{ kind: 'play', notes }`, `{ kind: 'preview', note }`, `{ kind: 'stop' }` (Task 8); the `'fail-load'` switch (Task 10); `AUDIO_UNAVAILABLE_MESSAGE` text (Task 11).

Covers spec §7 / §4 / §5: Play highlights events in order and returns to Play, Stop clears at once, Space toggles, play from the selection, fruit-key preview, and audio failure (toast + disabled Play with tooltip, editing continues).

- [ ] **Step 1: Write the spec**

**Create `e2e/playback.spec.ts`:**

```ts
import { expect, fruits, noteButton, openEditor, test, type Page } from './fixtures';

declare global {
  interface Window {
    __highlights?: string[];
  }
}

const halo = (page: Page) => page.locator('[data-kind="playing-halo"]');
const playButton = (page: Page) => page.getByRole('button', { name: 'Play', exact: true });
const stopButton = (page: Page) => page.getByRole('button', { name: 'Stop', exact: true });

/** Record the order in which events light up. */
const recordHighlights = (page: Page) =>
  page.evaluate(() => {
    const seen: string[] = [];
    window.__highlights = seen;
    new MutationObserver(() => {
      const index = document
        .querySelector('[data-kind="playing-halo"]')
        ?.getAttribute('data-event-index');
      if (index && seen[seen.length - 1] !== index) seen.push(index);
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });

const audioLog = (page: Page) => page.evaluate(() => window.__NOTE_CHOMP_AUDIO_LOG__ ?? []);

test('Play lights up each note in order, then returns to Play', async ({ page }) => {
  await openEditor(page, 'ceg');
  await page.getByLabel('Tempo').fill('160');
  await recordHighlights(page);
  await playButton(page).click();
  await expect(stopButton(page)).toBeVisible();
  await expect(playButton(page)).toBeVisible({ timeout: 5000 });
  await expect(halo(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.__highlights)).toEqual(['0', '1', '2']);
  expect(await audioLog(page)).toContainEqual({ kind: 'play', notes: ['C4', 'E4', 'G4'] });
});

test('Stop clears the highlight at once', async ({ page }) => {
  await openEditor(page, 'cdefgabc');
  await page.getByLabel('Tempo').fill('60');
  await playButton(page).click();
  await expect(halo(page)).toHaveAttribute('data-event-index', '1', { timeout: 3000 });
  await stopButton(page).click();
  await expect(halo(page)).toHaveCount(0);
  await expect(playButton(page)).toBeVisible();
  expect((await audioLog(page)).at(-1)).toEqual({ kind: 'stop' });
});

test('Space starts and stops playback', async ({ page }) => {
  await openEditor(page, 'cdefgabc');
  await page.keyboard.press(' ');
  await expect(stopButton(page)).toBeVisible();
  await expect(halo(page)).toHaveCount(1);
  await page.keyboard.press(' ');
  await expect(playButton(page)).toBeVisible();
  await expect(halo(page)).toHaveCount(0);
});

test('plays from the selected note', async ({ page }) => {
  await openEditor(page, 'cde');
  await noteButton(page, 2).click();
  await playButton(page).click();
  await expect(playButton(page)).toBeVisible({ timeout: 5000 });
  expect(await audioLog(page)).toContainEqual({ kind: 'play', notes: ['D4', 'E4'] });
});

test('fruit keys play a short preview', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Add A4' }).click();
  expect(await audioLog(page)).toContainEqual({ kind: 'preview', note: 'A4' });
});

test('if the piano cannot load, editing keeps working and Play explains', async ({ page }) => {
  await page.addInitScript(() => {
    window.__NOTE_CHOMP_FAKE_AUDIO__ = 'fail-load';
  });
  await openEditor(page, 'ce');
  await playButton(page).click();
  await expect(page.getByTestId('toast')).toContainText("couldn't load the piano sounds");
  await expect(playButton(page)).toBeDisabled();
  await expect(playButton(page)).toHaveAttribute('title', /playback is off/);
  await page.keyboard.press('g');
  await expect(fruits(page)).toHaveCount(3);
});
```

(The highlight order is recorded in the page with a `MutationObserver`, so a fast tempo cannot skip past an assertion. The fake player uses real timers: 3 quarters at 160 bpm take ≈ 1.1 s.)

- [ ] **Step 2: Run it**

Run (sandbox disabled): `timeout 300 npx playwright test e2e/playback.spec.ts --repeat-each=3`
Expected: `18 passed`.

- [ ] **Step 3: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled → 39 passed
git add e2e/playback.spec.ts
git commit -m "test(e2e): playback highlight, stop, Space, play from selection, previews, audio failure"
```

---

### Task 25: E2E: layout & quick fixes

**Files:**
- Create: `e2e/layout.spec.ts`, `e2e/quickfixes.spec.ts`

**Interfaces:**
- Consumes: fixtures; toast (`data-testid="toast"`, Task 12/14), `data-kind="measure-flash"` (Task 13), Help dialog "How to use the editor" (Task 12); `NEW_SONG_MESSAGE` text (Task 19); draft offer texts "Pick up where you left off?", Restore, Discard, "Saved!" (Task 20); `NOT_MUSIC_ERROR` / `skippedWarning` texts (Task 21); copy names (Task 22).

Covers spec §7: the staff stays in the viewport at 1280×800 while entering 30 notes (window never scrolls; dock and top bar stay visible), the toast + measure flash + auto-dismiss, the help popover, and every §6 quick fix.

- [ ] **Step 1: Write the layout spec**

**Create `e2e/layout.spec.ts`:**

```ts
import { expect, fruits, noteButton, openEditor, test } from './fixtures';

test.use({ viewport: { width: 1280, height: 800 } });

test('the staff, the newest note and the controls stay on screen while entering 30 notes', async ({
  page,
}) => {
  await openEditor(page);
  for (let i = 1; i <= 30; i++) {
    await page.keyboard.press('cdefgab'[i % 7]);
    if (i % 5 === 0) {
      await expect(fruits(page)).toHaveCount(i);
      await expect(noteButton(page, i)).toBeInViewport();
    }
  }
  await expect(page.locator('[data-kind="cursor"]')).toHaveCount(1);
  for (const name of ['Undo', 'Save', 'Play', 'Add C4', 'Quarter']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport();
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('errors show as a toast above the dock and go away by themselves', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Whole', exact: true }).click();
  await page.keyboard.press('c');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('3');
  await page.keyboard.press('d');
  const toast = page.getByTestId('toast');
  await expect(toast).toContainText('pushes the notes after it out of line');
  await expect(toast).toBeInViewport();
  await expect(page.locator('[data-kind="measure-flash"]')).toHaveCount(1);
  await expect(toast).toBeHidden({ timeout: 6000 });
});

test('the help button explains the controls', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Help' }).click();
  const help = page.getByRole('dialog', { name: 'How to use the editor' });
  await expect(help).toContainText('Space plays your song');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
});
```

- [ ] **Step 2: Write the quick-fix spec**

**Create `e2e/quickfixes.spec.ts`:**

```ts
import { expect, fruits, openEditor, test } from './fixtures';

test('New song on #/new starts fresh, asking first when there are unsaved notes', async ({
  page,
}) => {
  await openEditor(page, 'cd');
  let message = '';
  page.once('dialog', (dialog) => {
    message = dialog.message();
    void dialog.dismiss();
  });
  await page.getByRole('link', { name: 'New song' }).click();
  expect(message).toBe("Start a new song? Your current one isn't saved.");
  await expect(fruits(page)).toHaveCount(2);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('link', { name: 'New song' }).click();
  await expect(fruits(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByText('Pick up where you left off?')).toHaveCount(0);
});

test('Enter leaves the title so letter keys add notes again', async ({ page }) => {
  await openEditor(page);
  const title = page.getByLabel('Song title');
  await title.fill('Picnic');
  await title.press('Enter');
  await page.keyboard.press('d');
  await expect(title).toHaveValue('Picnic');
  await expect(fruits(page)).toHaveCount(1);
});

test('choosing a time signature hands the keys back to the editor', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Time signature').selectOption('3/4');
  await page.keyboard.press('e');
  await expect(fruits(page)).toHaveCount(1);
  await expect(page.getByLabel('Time signature')).toHaveValue('3/4');
});

test('offers to restore an unsaved new song after a reload', async ({ page }) => {
  await openEditor(page, 'cde');
  await page.reload();
  await expect(page.getByText('Pick up where you left off?')).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(fruits(page)).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(fruits(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Song title')).toBeVisible();
  await expect(page.getByText('Pick up where you left off?')).toHaveCount(0);
});

test('offers to restore unsaved changes to a saved song, and says Saved!', async ({ page }) => {
  await openEditor(page, 'cd');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('toast')).toHaveText(/Saved!/);
  await expect(page).toHaveURL(/#\/edit\//);
  await page.keyboard.press('e');
  await expect(fruits(page)).toHaveCount(3);
  await page.reload();
  await expect(fruits(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(fruits(page)).toHaveCount(3);
});

test('text that is not music fails to import', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByLabel('Song text').fill('Shopping list: milk, eggs, bread');
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('alert')).toContainText('No notes were found.');
  await expect(page.getByRole('button', { name: 'Save to my songs' })).toHaveCount(0);
});

test('unreadable symbols collapse into one warning, and editing the text clears the result', async ({
  page,
}) => {
  await page.goto('/#/import');
  const text = page.getByLabel('Song text');
  await text.fill('X:1\nT:Odd\nM:4/4\nL:1/4\nK:C\nC D # E F | & G4 |]');
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('status')).toHaveText(
    "Heads up:Skipped 2 characters we didn't understand.",
  );
  await text.fill('X:1\nT:Odd\nM:4/4\nL:1/4\nK:C\nC D E F |]');
  await expect(page.getByRole('heading', { name: 'Odd' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save to my songs' })).toHaveCount(0);
});

test('copying a starter song twice numbers the second copy', async ({ page }) => {
  const copy = async () => {
    await page.goto('/');
    await page
      .getByTestId('song-card')
      .filter({ hasText: 'Ode to Joy' })
      .getByRole('button', { name: 'Make a copy' })
      .click();
    await expect(page).toHaveURL(/#\/edit\//);
  };
  await copy();
  await copy();
  await expect(page.getByLabel('Song title')).toHaveValue('Ode to Joy (my copy 2)');
});
```

(`page.reload()` does not run `beforeunload` handlers in Playwright, so reloading a dirty editor is allowed and the draft survives in localStorage. The ABC in the warning test has full bars, so the only warning is the collapsed one.)

- [ ] **Step 3: Run them**

Run (sandbox disabled): `timeout 300 npx playwright test e2e/layout.spec.ts e2e/quickfixes.spec.ts --repeat-each=2`
Expected: `22 passed`.

- [ ] **Step 4: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled → 50 passed
git add e2e/layout.spec.ts e2e/quickfixes.spec.ts
git commit -m "test(e2e): editor layout, toast, help and the usability quick fixes"
```

---

### Task 26: README, final verification & real-audio check

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: user-facing docs for playback and selection; CC-BY attribution for the samples (spec §2.3); a verified, playtestable build.

- [ ] **Step 1: Document playback and credit the samples**

**Edit `README.md`** — replace:

```md
## Run it
```

with:

```md
## Play it

Press ▶ Play (or Space) in the editor to hear your song on a piano; the note being played lights up and
the page follows it. The 🐢 … 🐇 slider sets the tempo (60–160 beats per minute). Tap a note on the staff
to choose it, then tap a fruit key, type a letter, or drag it up and down to change it. ← → walk through
the notes, ↑ ↓ move the chosen note, Esc lets go. The "?" button in the editor lists every shortcut.

## Run it
```

**Edit `README.md`** — replace:

```md
- `src/export/pdf/` — vector PDF via jsPDF + svg2pdf.js.
```

with:

```md
- `src/export/pdf/` — vector PDF via jsPDF + svg2pdf.js.
- `src/audio/` — playback behind a `NotePlayer` interface: the Tone.js piano (`ToneNotePlayer`, loaded
  on first use) and a fake used by the tests.
```

**Edit `README.md`** — replace:

```md
Layer rules are enforced by ESLint (`core` imports nothing else; `formats` imports only `core`).
```

with:

```md
Layer rules are enforced by ESLint (`core` imports nothing else; `formats` imports only `core`; `audio`
imports only `core` and Tone.js, and nothing but `audio` and `app` may import Tone.js).
```

**Append to `README.md`:**

```md
## Credits

Piano sound: [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by
Alexander Holm, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The MP3 files in
`public/samples/piano/` are the [Tone.js](https://tonejs.github.io/) project's conversions
(<https://tonejs.github.io/audio/salamander/>), unmodified. Playback uses
[Tone.js](https://github.com/Tonejs/Tone.js) (MIT).
```

- [ ] **Step 2: Run the whole CI sequence locally**

```bash
npm run format && npm run format:check && npm run lint && npm run typecheck && timeout 300 npm test
timeout 300 npm run build && ! grep -rq APE_KEY dist && echo "no key in bundle"
lsof -iTCP:5179 -sTCP:LISTEN; timeout 600 npm run test:e2e   # sandbox disabled
```

Expected: format/lint/typecheck clean; all unit tests pass (≈ 450); build succeeds with a separate Tone chunk and `dist/samples/piano/` (11 mp3 + ATTRIBUTION.txt); "no key in bundle"; **50** e2e tests pass.

- [ ] **Step 3: Real-audio check in the shared debug Chrome (spec §7 "Manual")**

```bash
curl -fsS --max-time 2 http://127.0.0.1:9222/json/version || echo "ask the user to run: ! gcdb"
timeout 5 lsof -iTCP:5173 -sTCP:LISTEN || (npm run dev -- --port 5173 > /tmp/note-chomp-dev.log 2>&1 &)
```

Load the `browser-automation-gcdb` skill, open a **new tab** at `http://localhost:5173/#/edit/builtin-jingle-bells` (1280×800) and confirm, with `browser_evaluate` / screenshots where useful:

1. ▶ Play → "Loading piano…" then "■ Stop"; the piano is audible (ask the user to confirm sound); the yellow halo walks through the notes in order and the sheet scrolls to follow; at the end the button returns to "▶ Play".
2. Space stops and starts playback; ■ stops instantly.
3. Click the 5th note: blue glow, no pink cursor, a short preview; ▶ Play starts from that note.
4. Drag a selected note up two steps: the pitch changes step by step with previews; one Undo restores it.
5. Type 30 notes on `#/new`: the newest note stays visible; the toast for an impossible length appears above the dock and fades; "?" opens the help.
6. In DevTools Network (or `performance.getEntriesByType('resource')`), Tone's chunk and the 11 sample files load only after the first Play/preview.

Close only the tab you opened. Note any problem as a follow-up task instead of hand-waving it.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: playback, selection and drag in the README; credit the Salamander piano samples"
```

- [ ] **Step 5: Hand-off**

Report to the user: what changed (playback, select & drag, layout, quick fixes), how to try it (`npm run dev`, then open a starter song and press ▶ Play or Space), and the test counts from Step 2. Then use superpowers:finishing-a-development-branch.
