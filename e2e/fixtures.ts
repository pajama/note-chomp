import { expect, test as base, type Page } from '@playwright/test';

export { expect, type Page };

/** Every e2e test runs with the fake audio player (no Tone.js, no sample downloads). */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      window.__NOTE_CHOMP_FAKE_AUDIO__ ??= true;
    });
    await provide(page);
  },
});

export const fruits = (page: Page) => page.getByTestId('song-pages').locator('[data-kind="fruit"]');

/** Open the editor at `hash`, wait until it is ready for keys, then type `letters`. */
export async function openEditor(page: Page, letters = '', hash = '/#/new') {
  await page.goto(hash);
  await expect(page.getByLabel('Song title')).toBeVisible();
  const before = await fruits(page).count();
  for (const letter of letters) await page.keyboard.press(letter);
  await expect(fruits(page)).toHaveCount(before + letters.length);
}

/** The note column for event n (1-based), found by its accessible name. */
export const noteButton = (page: Page, n: number) =>
  page.getByRole('button', { name: new RegExp(`^Note ${n}:`) });
