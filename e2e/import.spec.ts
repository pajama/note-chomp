import { expect, test } from '@playwright/test';

const ABC = 'X:1\nT:Pasted Tune\nM:4/4\nL:1/4\nK:C\nE D C2 | E D C2 |]\nw: hot cross buns\n';

const XML = `<?xml version="1.0"?><score-partwise><work><work-title>From MuseScore</work-title></work>
<part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1">
<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;

test('imports pasted ABC, shows warnings and a preview, and saves it', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByLabel('Song text').fill(ABC);
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('heading', { name: 'Pasted Tune' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Lyrics were ignored.');
  await expect(page.getByTestId('song-pages').locator('[data-kind="fruit"]')).toHaveCount(6);

  await page.getByRole('button', { name: 'Save to my songs' }).click();
  await expect(page.getByTestId('song-card').filter({ hasText: 'Pasted Tune' })).toBeVisible();
});

test('explains why a song could not be imported', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByLabel('Song text').fill('X:1\nT:Sharp\nM:4/4\nL:1/4\nK:C\n^F4 |\n');
  await page.getByRole('button', { name: 'Import text' }).click();
  await expect(page.getByRole('alert')).toContainText("F♯ isn't in the key of C");
});

test('imports a MusicXML file', async ({ page }) => {
  await page.goto('/#/import');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'song.musicxml',
    mimeType: 'application/xml',
    buffer: Buffer.from(XML),
  });
  await expect(page.getByRole('heading', { name: 'From MuseScore' })).toBeVisible();
});
