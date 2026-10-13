import { expect, test } from '@playwright/test';

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
