import type { TestInfo } from '@playwright/test';
import { expect, fruits, noteButton, openEditor, test, type Page } from '../fixtures';
import {
  center,
  expectNoHorizontalOverflow,
  rect,
  settleSheetAt,
  sheetScrollTop,
  swipe,
  windowScroll,
} from './touch-helpers';

interface Case {
  name: string;
  project: 'iphone' | 'ipad';
  width: number;
  height: number;
  /** The sheet gets at least this share of the screen height... */
  sheetRatio?: number;
  /** ...or at least this many px. */
  sheetPx?: number;
  keyHeight: number;
  maxDock?: number;
  /** Narrowest note column on screen (the test song: 4/4 quarter notes). */
  minColumn?: number;
}

const CASES: Case[] = [
  {
    name: 'phone portrait',
    project: 'iphone',
    width: 390,
    height: 844,
    sheetRatio: 0.45,
    keyHeight: 44,
    maxDock: 300,
  },
  {
    name: 'small phone',
    project: 'iphone',
    width: 320,
    height: 568,
    sheetPx: 120,
    // 296px of sheet can't fit a 40px column beside the monster and the margins.
    minColumn: 36,
    keyHeight: 44,
  },
  {
    name: 'phone landscape',
    project: 'iphone',
    width: 844,
    height: 390,
    sheetRatio: 0.6,
    keyHeight: 44,
  },
  {
    name: 'small phone landscape',
    project: 'iphone',
    width: 667,
    height: 375,
    sheetRatio: 0.6,
    keyHeight: 44,
  },
  {
    name: 'tablet portrait',
    project: 'ipad',
    width: 820,
    height: 1180,
    sheetRatio: 0.6,
    keyHeight: 44,
  },
  {
    name: 'tablet landscape',
    project: 'ipad',
    width: 1180,
    height: 820,
    sheetRatio: 0.6,
    keyHeight: 52,
  },
];

const skipUnless = (testInfo: TestInfo, c: Case) =>
  test.skip(testInfo.project.name !== c.project, `${c.project} only`);

async function open(page: Page, c: Case) {
  await page.setViewportSize({ width: c.width, height: c.height });
  await openEditor(page, 'cdefgabc'.repeat(3));
  await settleSheetAt(page, 0);
}

const top = async (page: Page, name: string) =>
  (await page.getByRole('button', { name, exact: true }).boundingBox())?.y ?? NaN;

for (const c of CASES) {
  test.describe(`${c.name} ${c.width}x${c.height}`, () => {
    test.beforeEach(() => skipUnless(test.info(), c));

    test('the sheet gets the room, the controls fit, nothing overflows', async ({
      page,
    }, testInfo) => {
      await open(page, c);
      await testInfo.attach(`${c.width}x${c.height}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await expectNoHorizontalOverflow(page);
      const sheet = await rect(page, '.sheet-scroll');
      if (c.sheetRatio) expect(sheet.height / c.height).toBeGreaterThanOrEqual(c.sheetRatio);
      if (c.sheetPx) expect(sheet.height).toBeGreaterThanOrEqual(c.sheetPx);

      const dock = page.locator('.editor-dock');
      const dockBox = await rect(page, '.editor-dock');
      expect(dockBox.bottom).toBeLessThanOrEqual(c.height + 0.5);
      if (c.maxDock) expect(dockBox.height).toBeLessThanOrEqual(c.maxDock);

      const keys = await page
        .locator('.fruit-key')
        .evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect()).map((r) => [r.width, r.height]),
        );
      expect(keys).toHaveLength(8);
      for (const [w, h] of keys) {
        expect(w).toBeGreaterThanOrEqual(44);
        expect(h).toBeGreaterThanOrEqual(c.keyHeight);
      }
      // Every key and Play is on screen, or reachable by scrolling the dock itself.
      const reach = await dock.evaluate((d) => {
        const box = d.getBoundingClientRect();
        const hidden = d.scrollHeight - d.clientHeight;
        return [...d.querySelectorAll('.fruit-key, .play-button')].every((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left >= 0 &&
            r.right <= window.innerWidth + 0.5 &&
            r.top >= box.top - 0.5 &&
            r.bottom <= Math.min(window.innerHeight, box.bottom + hidden) + 0.5
          );
        });
      });
      expect(reach).toBe(true);

      const columns = await page
        .locator('[data-kind="note-target"]')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
      expect(Math.min(...columns)).toBeGreaterThanOrEqual(c.minColumn ?? 40);
      expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
    });

    test('help opens fully on screen and a tap outside closes it', async ({ page }) => {
      await open(page, c);
      await page.getByRole('button', { name: 'Help' }).tap();
      const help = page.locator('#editor-help');
      await expect(help).toBeVisible();
      const r = await rect(page, '#editor-help');
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(c.width);
      expect(r.bottom).toBeLessThanOrEqual(c.height);
      const sheet = await rect(page, '.sheet-scroll');
      await page.touchscreen.tap(sheet.left + 2, sheet.bottom - 4);
      await expect(help).toBeHidden();
    });

    test('a tapped note drags without moving the page or the sheet', async ({ page }) => {
      await open(page, c);
      await noteButton(page, 2).tap();
      await expect(noteButton(page, 2)).toHaveAccessibleName(/selected$/);
      const before = await settleSheetAt(page, 0);
      const { x, y, space } = await center(page, 2);
      await swipe(page, x, y, y - space);
      await expect.poll(() => fruits(page).nth(1).getAttribute('data-pitch')).toBe('F');
      expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
      expect(await sheetScrollTop(page)).toBe(before);
    });
  });
}

test('phone portrait: help sits beside Play, and the length row scrolls on its own', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'iphone only');
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, 'cde');
  expect(Math.abs((await top(page, 'Help')) - (await top(page, 'Play')))).toBeLessThanOrEqual(4);
  const row = await rect(page, '.duration-picker');
  await swipe(
    page,
    row.right - 10,
    row.top + row.height / 2,
    row.top + row.height / 2,
    row.left + 10,
  );
  expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
});

test('small phone: Play and the length row stay inside the screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'iphone only');
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, 'cde');
  for (const selector of ['.play-button', '.duration-picker']) {
    const r = await rect(page, selector);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(320);
  }
  // Every length button can be scrolled to.
  const reachable = await page.locator('.duration-picker').evaluate((row) => {
    const box = row.getBoundingClientRect();
    const extra = row.scrollWidth - row.clientWidth;
    return [...row.querySelectorAll('button')].every((b) => {
      const r = b.getBoundingClientRect();
      return r.left >= box.left - 0.5 && r.right <= box.right + extra + 0.5;
    });
  });
  expect(reachable).toBe(true);
});

test('phone landscape: the side dock fits without scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'iphone only');
  await page.setViewportSize({ width: 844, height: 390 });
  await openEditor(page, 'cde');
  const fits = await page
    .locator('.editor-dock')
    .evaluate((d) => d.scrollHeight <= d.clientHeight + 1);
  expect(fits).toBe(true);
});

test('tablet landscape: Play, the octave buttons and help share one row', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad', 'ipad only');
  await page.setViewportSize({ width: 1180, height: 820 });
  await openEditor(page, 'cde');
  const play = await top(page, 'Play');
  const help = await top(page, 'Help');
  const octave = (await page.getByRole('button', { name: 'Higher notes' }).boundingBox())?.y ?? NaN;
  expect(Math.abs(help - play)).toBeLessThanOrEqual(6);
  expect(Math.abs(octave - play)).toBeLessThanOrEqual(6);
});

test('the viewport allows pinch zoom and covers the notch area', async ({ page }) => {
  await page.goto('/#/new');
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('viewport-fit=cover');
  expect(content).not.toMatch(/user-scalable|maximum-scale/);
  const pad = await page
    .locator('.editor-dock')
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(14);
});
