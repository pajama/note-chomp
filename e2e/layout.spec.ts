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

test('Esc closes help even when focus is elsewhere, keeps the selection, and refocuses "?"', async ({
  page,
}) => {
  await openEditor(page, 'cde');
  const helpButton = page.getByRole('button', { name: 'Help' });
  await helpButton.click();
  const help = page.getByRole('dialog', { name: 'How to use the editor' });
  await expect(help).toBeVisible();
  await noteButton(page, 2).click(); // focus leaves the popover (and closes it)
  await expect(help).toBeHidden();
  await helpButton.click();
  await expect(help).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await expect(noteButton(page, 2)).toHaveAccessibleName(/selected$/);
  await expect(helpButton).toBeFocused();
});
