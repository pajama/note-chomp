import { expect, test, type Page } from './fixtures';

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
  await expect(page.getByTestId('toast')).toContainText("doesn't fit");
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

test('a new song or starter copy shows Save until it has been saved', async ({ page }) => {
  await page.goto('/#/new');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await page.goto('/#/edit/builtin-hot-cross-buns');
  await expect(page.getByLabel('Song title')).toHaveValue('Hot Cross Buns (my copy)');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
});

test('the first save keeps undo history, the cursor and the chosen length', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Half', exact: true }).click();
  await page.getByRole('button', { name: 'Add C4' }).click();
  await page.getByRole('button', { name: 'Add D4' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/#\/edit\//);
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Half', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(fruits(page)).toHaveCount(1);
});

test('a starter copy keeps undo history after its first save', async ({ page }) => {
  await page.goto('/#/edit/builtin-hot-cross-buns');
  await expect(fruits(page)).toHaveCount(17);
  await page.keyboard.press('Backspace');
  await expect(fruits(page)).toHaveCount(16);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/builtin-hot-cross-buns/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(fruits(page)).toHaveCount(17);
});

test('asks before leaving a song with unsaved changes through a link', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Add C4' }).click();

  let message = '';
  page.once('dialog', (dialog) => {
    message = dialog.message();
    void dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Import' }).click();
  await expect(page).toHaveURL(/#\/new$/);
  expect(message).toContain('not saved');
  await expect(fruits(page)).toHaveCount(1);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('link', { name: 'Import' }).click();
  await expect(page.getByRole('heading', { name: 'Import a song' })).toBeVisible();
});

test('asks before leaving a song with unsaved changes with the Back button', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('link', { name: 'New song' }).click();
  await page.getByRole('button', { name: 'Add C4' }).click();
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.evaluate(() => history.back());
  await expect(page.getByRole('button', { name: 'Add C4' })).toBeVisible();
  await expect(page).toHaveURL(/#\/new$/);
  await expect(fruits(page)).toHaveCount(1);
});

test('does not ask before leaving a saved song', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.goto('/#/new');
  await page.getByRole('button', { name: 'Add C4' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Note Chomp' }).click();
  await expect(page.getByRole('heading', { name: 'My songs' })).toBeVisible();
  expect(dialogs).toEqual([]);
});
