import { expect, fruits, noteButton, openEditor, test, type Page } from './fixtures';
import { swipe } from './mobile/touch-helpers';

// An iPad-sized touch screen.
test.use({ viewport: { width: 1024, height: 700 }, hasTouch: true });

async function center(page: Page, n: number) {
  const box = await noteButton(page, n).boundingBox();
  if (!box) throw new Error(`note ${n} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, space: box.height / 11 };
}

const scrollTop = (page: Page) => page.getByTestId('song-pages').evaluate((el) => el.scrollTop);

test('swiping up over a note that is not selected scrolls the sheet and leaves the note alone', async ({
  page,
}) => {
  await openEditor(page, 'cdefgabc'.repeat(5));
  // Back to the top, once the smooth scroll that followed the typing has finished.
  await expect(async () => {
    await page.getByTestId('song-pages').evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(200);
    expect(await scrollTop(page)).toBe(0);
  }).toPass();
  const { x, y } = await center(page, 2);
  await swipe(page, x, y, y - 200);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(50);
  await expect(fruits(page).nth(1)).toHaveAttribute('data-pitch', 'D');
  // A scroll is not a tap: it neither selects the note nor plays it.
  await expect(noteButton(page, 2)).toHaveAccessibleName('Note 2: D, quarter note');
  const previews = await page.evaluate(() =>
    (window.__NOTE_CHOMP_AUDIO_LOG__ ?? []).filter((c) => c.kind === 'preview'),
  );
  expect(previews).toHaveLength(40); // one per typed note, none for the swipe
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled(); // typing is undoable
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(fruits(page)).toHaveCount(39); // the swipe made no undo step of its own
});

test('a tap selects a note, and then a swipe on it changes its pitch', async ({ page }) => {
  await openEditor(page, 'cde');
  await noteButton(page, 2).tap();
  await expect(noteButton(page, 2)).toHaveAccessibleName('Note 2: D, quarter note, selected');
  const { x, y, space } = await center(page, 2);
  await swipe(page, x, y, y - space); // two steps up: D4 -> F4
  await expect(fruits(page).nth(1)).toHaveAttribute('data-pitch', 'F');
  await expect(noteButton(page, 2)).toHaveAccessibleName('Note 2: F, quarter note, selected');
});
