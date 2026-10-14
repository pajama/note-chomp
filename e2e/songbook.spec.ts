import { expect, test } from './fixtures';

test('lists the eight starter songs and an empty My songs section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Starter songs' })).toBeVisible();
  await expect(page.getByTestId('song-card')).toHaveCount(8);
  await expect(page.getByTestId('song-card').filter({ hasText: 'Hot Cross Buns' })).toBeVisible();
  await expect(page.getByText('No songs yet.')).toBeVisible();
});

test('copies a starter song, then deletes the copy', async ({ page }) => {
  await page.goto('/');
  await page
    .getByTestId('song-card')
    .filter({ hasText: 'Ode to Joy' })
    .getByRole('button', { name: 'Make a copy' })
    .click();
  await expect(page).toHaveURL(/#\/edit\//);

  await page.goto('/');
  const copy = page.getByTestId('song-card').filter({ hasText: 'Ode to Joy (my copy)' });
  await expect(copy).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await copy.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No songs yet.')).toBeVisible();
});

test('says "1 note" rather than "1 notes"', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByLabel('Song title').fill('Just One');
  await page.getByRole('button', { name: 'Add C4' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Note Chomp' }).click();
  const card = page.getByTestId('song-card').filter({ hasText: 'Just One' });
  await expect(card).toContainText('· 1 note');
  await expect(card).not.toContainText('1 notes');
  await expect(page.getByTestId('song-card').filter({ hasText: 'Hot Cross Buns' })).toContainText(
    '17 notes',
  );
});
