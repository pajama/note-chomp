import { expect, test } from './fixtures';

test('loads the app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Note Chomp' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New song' })).toBeVisible();
});

test('shows a friendly not-found page', async ({ page }) => {
  await page.goto('/#/nope/nope/nope');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
