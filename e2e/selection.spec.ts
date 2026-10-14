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

test('Eighth on a selected quarter in a full measure makes two beamed eighths, not an error', async ({
  page,
}) => {
  await openEditor(page, 'cdefg');
  await noteButton(page, 1).click();
  await page.getByRole('button', { name: 'Eighth', exact: true }).click();
  await expect(fruits(page)).toHaveCount(6);
  await expect(page.getByTestId('toast')).toHaveCount(0);
  await expect(noteButton(page, 1)).toHaveAccessibleName('Note 1: C, eighth note, selected');
  await expect(noteButton(page, 2)).toHaveAccessibleName('Note 2: C, eighth note');
  await expect(noteButton(page, 3)).toHaveAccessibleName('Note 3: D, quarter note');
  await expect(glow(page)).toHaveAttribute('data-event-index', '0');
  await expect(page.getByTestId('song-pages').locator('[data-kind="beam"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(fruits(page)).toHaveCount(5);
  await expect(noteButton(page, 1)).toHaveAccessibleName('Note 1: C, quarter note, selected');
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

test('clicking a note while typing a title hands the letter keys back to the note', async ({
  page,
}) => {
  await openEditor(page, 'cde');
  await page.getByLabel('Song title').fill('X');
  await noteButton(page, 2).click();
  await page.keyboard.press('g');
  await expect(fruits(page).nth(1)).toHaveAttribute('data-pitch', 'G');
  await expect(page.getByLabel('Song title')).toHaveValue('X');
});

test('pressing blank sheet beside the staff lets go of the selected note', async ({ page }) => {
  await openEditor(page, 'cde');
  await noteButton(page, 2).click();
  await expect(glow(page)).toHaveCount(1);
  const sheet = await page.getByTestId('song-pages').boundingBox();
  if (!sheet) throw new Error('sheet not visible');
  await page.mouse.click(sheet.x + 4, sheet.y + 4); // the scroller's padding, outside the svg
  await expect(glow(page)).toHaveCount(0);
  await expect(cursor(page)).toHaveCount(1);
});

test('clicking between notes places the cursor there', async ({ page }) => {
  await openEditor(page, 'ce');
  const gap = page.locator('[data-kind="gap-target"][data-gap-index="1"]');
  await gap.click();
  await page.keyboard.press('d');
  await expect(fruits(page).nth(1)).toHaveAttribute('data-pitch', 'D');
});
