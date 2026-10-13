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
