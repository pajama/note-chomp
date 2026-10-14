import { expect, fruits, openEditor, test } from './fixtures';

test('New song on #/new starts fresh, asking first when there are unsaved notes', async ({
  page,
}) => {
  await openEditor(page, 'cd');
  let message = '';
  page.once('dialog', (dialog) => {
    message = dialog.message();
    void dialog.dismiss();
  });
  await page.getByRole('link', { name: 'New song' }).click();
  expect(message).toBe("Start a new song? Your current one isn't saved.");
  await expect(fruits(page)).toHaveCount(2);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('link', { name: 'New song' }).click();
  await expect(fruits(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByText('Pick up where you left off?')).toHaveCount(0);
});

test('Enter leaves the title so letter keys add notes again', async ({ page }) => {
  await openEditor(page);
  const title = page.getByLabel('Song title');
  await title.fill('Picnic');
  await title.press('Enter');
  await page.keyboard.press('d');
  await expect(title).toHaveValue('Picnic');
  await expect(fruits(page)).toHaveCount(1);
});

test('choosing a time signature hands the keys back to the editor', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Time signature').selectOption('3/4');
  await page.keyboard.press('e');
  await expect(fruits(page)).toHaveCount(1);
  await expect(page.getByLabel('Time signature')).toHaveValue('3/4');
});

test('offers to restore an unsaved new song after a reload', async ({ page }) => {
  await openEditor(page, 'cde');
  await page.reload();
  await expect(page.getByText('Pick up where you left off?')).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(fruits(page)).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(fruits(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Song title')).toBeVisible();
  await expect(page.getByText('Pick up where you left off?')).toHaveCount(0);
});

test('offers to restore unsaved changes to a saved song, and says Saved!', async ({ page }) => {
  await openEditor(page, 'cd');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('toast')).toHaveText(/Saved!/);
  await expect(page).toHaveURL(/#\/edit\//);
  await page.keyboard.press('e');
  await expect(fruits(page)).toHaveCount(3);
  await page.reload();
  await expect(fruits(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(fruits(page)).toHaveCount(3);
});

test('text that is not music fails to import', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByLabel('Song text').fill('Shopping list: milk, eggs, bread');
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('alert')).toContainText('No notes were found.');
  await expect(page.getByRole('button', { name: 'Save to my songs' })).toHaveCount(0);
});

test('unreadable symbols collapse into one warning, and editing the text clears the result', async ({
  page,
}) => {
  await page.goto('/#/import');
  const text = page.getByLabel('Song text');
  await text.fill('X:1\nT:Odd\nM:4/4\nL:1/4\nK:C\nC D # E F | & G4 |]');
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('status')).toHaveText(
    "Heads up:Skipped 2 characters we didn't understand.",
  );
  await text.fill('X:1\nT:Odd\nM:4/4\nL:1/4\nK:C\nC D E F |]');
  await expect(page.getByRole('heading', { name: 'Odd' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save to my songs' })).toHaveCount(0);
});

test('copying a starter song twice numbers the second copy', async ({ page }) => {
  const copy = async () => {
    await page.goto('/');
    await page
      .getByTestId('song-card')
      .filter({ hasText: 'Ode to Joy' })
      .getByRole('button', { name: 'Make a copy' })
      .click();
    await expect(page).toHaveURL(/#\/edit\//);
  };
  await copy();
  await copy();
  await expect(page.getByLabel('Song title')).toHaveValue('Ode to Joy (my copy 2)');
});
