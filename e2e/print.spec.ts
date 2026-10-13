import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function downloadPdf(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  const file = await download.path();
  return { name: download.suggestedFilename(), text: (await readFile(file)).toString('latin1') };
}

const pageCount = (pdf: string) => (pdf.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

test('exports Hot Cross Buns as a one-page vector PDF', async ({ page }) => {
  await page.goto('/#/print/builtin-hot-cross-buns');
  await expect(page.locator('.page-svg')).toHaveCount(1);
  const pdf = await downloadPdf(page);
  expect(pdf.name).toBe('hot-cross-buns.pdf');
  expect(pdf.text.startsWith('%PDF-')).toBe(true);
  expect(pageCount(pdf.text)).toBe(1);
  expect(pdf.text).not.toContain('/Subtype /Image');
});

test('PDF pages follow the preview when the staff gets bigger', async ({ page }) => {
  await page.goto('/#/print/builtin-jingle-bells');
  await page.getByLabel('Staff size').selectOption({ label: 'Jumbo' });
  const previewPages = await page.locator('.page-svg').count();
  expect(previewPages).toBeGreaterThan(1);
  const pdf = await downloadPdf(page);
  expect(pageCount(pdf.text)).toBe(previewPages);
});

test('preview responds to label and legend options', async ({ page }) => {
  await page.goto('/#/print/builtin-hot-cross-buns');
  await page.getByLabel('Labels').selectOption('solfege');
  await expect(page.locator('.page-svg text', { hasText: 'Mi' }).first()).toBeVisible();
  await page.getByLabel('Fruit legend').uncheck();
  await expect(page.locator('[data-kind="legend"]')).toHaveCount(0);
});

test('a PDF error is shown on screen but not printed on paper', async ({ page }) => {
  await page.route(/svg2pdf/, (route) => route.abort());
  await page.goto('/#/print/builtin-hot-cross-buns');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText("Couldn't make the PDF");
  await expect(alert).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(alert).toBeHidden();
});
