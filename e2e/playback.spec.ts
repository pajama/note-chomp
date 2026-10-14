import { expect, fruits, noteButton, openEditor, test, type Page } from './fixtures';

declare global {
  interface Window {
    __highlights?: string[];
  }
}

const halo = (page: Page) => page.locator('[data-kind="playing-halo"]');
const playButton = (page: Page) => page.getByRole('button', { name: 'Play', exact: true });
/** "Stop" while playing; "Loading piano, press to cancel" while the piano loads (same button). */
const stopButton = (page: Page) => page.getByRole('button', { name: /^(Stop|Loading piano)/ });

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

test('Space plays after tapping a fruit key, instead of tapping it again', async ({ page }) => {
  await openEditor(page, 'cdefg');
  await page.getByRole('button', { name: 'Add C4' }).click();
  await expect(fruits(page)).toHaveCount(6);
  await page.keyboard.press(' ');
  await expect(stopButton(page)).toBeVisible();
  await expect(fruits(page)).toHaveCount(6);
});

test('editor keys still work after moving the tempo slider', async ({ page }) => {
  await openEditor(page, 'cdefgabc');
  await page.getByLabel('Tempo').fill('120');
  await page.keyboard.press(' ');
  await expect(stopButton(page)).toBeVisible();
  await page.keyboard.press(' ');
  await expect(playButton(page)).toBeVisible();
  await page.keyboard.press('d');
  await expect(fruits(page)).toHaveCount(9);
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
  // Typing "c" previewed the note, which already tried (and failed) to load the piano.
  await expect(page.getByTestId('toast')).toContainText("couldn't load the piano sounds");
  await expect(playButton(page)).toBeDisabled();
  await expect(playButton(page)).toHaveAttribute('title', /playback is off/);
  await page.keyboard.press('g');
  await expect(fruits(page)).toHaveCount(3);
});

test('holding Space starts playback once instead of flapping play/stop', async ({ page }) => {
  await openEditor(page, 'cdefgabc');
  await page.getByLabel('Tempo').fill('60');
  await page.keyboard.down(' ');
  // Further keydowns while the key is held are auto-repeats (event.repeat is true).
  for (let i = 0; i < 5; i++) await page.keyboard.down(' ');
  await page.keyboard.up(' ');
  await expect(stopButton(page)).toBeVisible();
  const log = await audioLog(page);
  expect(log.filter((c) => c.kind === 'play')).toHaveLength(1);
  expect(log.filter((c) => c.kind === 'stop')).toHaveLength(0);
});
