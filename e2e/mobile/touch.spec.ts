import type { TestInfo } from '@playwright/test';
import { expect, fruits, noteButton, openEditor, test, type Page } from '../fixtures';
import {
  center,
  hold,
  longPress,
  rect,
  settleSheetAt,
  sheetScrollTop,
  swipe,
  windowScroll,
} from './touch-helpers';

const onlyOn = (testInfo: TestInfo, project: string) =>
  test.skip(testInfo.project.name !== project, `${project} only`);

const pitchOf = (page: Page, n: number) =>
  fruits(page)
    .nth(n - 1)
    .getAttribute('data-pitch');

test('the emulated device has a coarse pointer and no hover (what the mobile CSS keys off)', async ({
  page,
}) => {
  await page.goto('/#/new');
  expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
});

test.describe('a drag on a note never moves the page or the sheet', () => {
  test('tap a note, then drag it up a staff space: D becomes F and nothing scrolls', async ({
    page,
  }) => {
    await openEditor(page, 'cde');
    await noteButton(page, 2).tap();
    await expect(noteButton(page, 2)).toHaveAccessibleName(/selected$/);
    const top = await settleSheetAt(page, 0);
    const { x, y, space } = await center(page, 2);
    await swipe(page, x, y, y - space);
    await expect.poll(() => pitchOf(page, 2)).toBe('F');
    expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
    expect(await sheetScrollTop(page)).toBe(top);
  });

  test('a swipe over a note that is not selected scrolls the sheet and leaves the note alone', async ({
    page,
  }) => {
    await openEditor(page, 'cdefgabc'.repeat(6));
    await settleSheetAt(page, 0);
    const { x, y } = await center(page, 2);
    await swipe(page, x, y, y - 200);
    await expect.poll(() => sheetScrollTop(page)).toBeGreaterThan(50);
    expect(await pitchOf(page, 2)).toBe('D');
    await expect(noteButton(page, 2)).toHaveAccessibleName('Note 2: D, quarter note');
    expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
  });

  test('plain touch PointerEvents (no CDP) drag a selected note', async ({ page }) => {
    await openEditor(page, 'cde');
    await noteButton(page, 2).tap();
    await expect(noteButton(page, 2)).toHaveAccessibleName(/selected$/);
    const { x, y, space } = await center(page, 2);
    const init = { pointerType: 'touch', isPrimary: true, button: 0, pointerId: 7, clientX: x };
    const target = noteButton(page, 2);
    await target.dispatchEvent('pointerdown', { ...init, clientY: y });
    await target.dispatchEvent('pointermove', { ...init, clientY: y - space / 2 });
    await target.dispatchEvent('pointermove', { ...init, clientY: y - space });
    await target.dispatchEvent('pointerup', { ...init, clientY: y - space });
    await expect.poll(() => pitchOf(page, 2)).toBe('F');
  });

  test('pointercancel in the middle of a drag keeps one undo step and stops listening', async ({
    page,
  }) => {
    await openEditor(page, 'cde');
    await noteButton(page, 2).tap();
    const { x, y, space } = await center(page, 2);
    const init = { pointerType: 'touch', isPrimary: true, button: 0, pointerId: 9, clientX: x };
    const target = noteButton(page, 2);
    await target.dispatchEvent('pointerdown', { ...init, clientY: y });
    await target.dispatchEvent('pointermove', { ...init, clientY: y - space });
    await expect.poll(() => pitchOf(page, 2)).toBe('F');
    await target.dispatchEvent('pointercancel', { ...init, clientY: y - space });
    await target.dispatchEvent('pointermove', { ...init, clientY: y - 3 * space });
    await page.waitForTimeout(100);
    expect(await pitchOf(page, 2)).toBe('F');
    await page.getByRole('button', { name: 'Undo' }).tap();
    await expect.poll(() => pitchOf(page, 2)).toBe('D');
    await expect(fruits(page)).toHaveCount(3);
  });

  test('the sheet does not scroll under the finger while a note near its edge is dragged', async ({
    page,
  }, testInfo) => {
    onlyOn(testInfo, 'iphone');
    await page.setViewportSize({ width: 390, height: 844 });
    await openEditor(page, 'cdefgabc'.repeat(5));
    await settleSheetAt(page, 0);
    const n = 21;
    await noteButton(page, n).scrollIntoViewIfNeeded();
    await noteButton(page, n).tap();
    await expect(noteButton(page, n)).toHaveAccessibleName(/selected$/);
    // Let the column hang 30px off the bottom of the sheet, the case that used to auto-scroll.
    const scroller = await rect(page, '.sheet-scroll');
    const column = await noteButton(page, n).boundingBox();
    if (!column) throw new Error('no column');
    const before = await settleSheetAt(
      page,
      (await sheetScrollTop(page)) + column.y + column.height - scroller.bottom - 30,
    );
    const start = await pitchOf(page, n);
    const { x, y, space } = await center(page, n);
    expect(y).toBeLessThan(scroller.bottom);
    const finger = await hold(page, x, y, y - 3 * space);
    for (let i = 0; i < 2; i++) {
      expect(await sheetScrollTop(page)).toBe(before);
      expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
      await page.waitForTimeout(300);
    }
    expect(await pitchOf(page, n)).not.toBe(start);
    await finger.release();
  });
});

test.describe('no page-level side effects of touch', () => {
  test('overscroll does not chain to the page (no pull-to-refresh, no rubber band)', async ({
    page,
  }) => {
    await openEditor(page, 'cdefgabc'.repeat(5));
    expect(await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY)).toBe(
      'none',
    );
    expect(
      await page
        .locator('.sheet-scroll')
        .evaluate((el) => getComputedStyle(el).overscrollBehaviorY),
    ).toBe('contain');
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    await settleSheetAt(page, 0);
    const sheet = await rect(page, '.sheet-scroll');
    const x = sheet.left + 4;
    await swipe(page, x, sheet.top + 20, sheet.top + 220); // pull down at the top
    expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
    await settleSheetAt(page, 'bottom');
    await swipe(page, x, sheet.bottom - 20, sheet.bottom - 220); // push up at the bottom
    expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
    // A dock swipe has nothing to scroll.
    const dock = await rect(page, '.editor-dock');
    await swipe(page, dock.left + 4, dock.top + 10, dock.top + 200);
    expect(await windowScroll(page)).toEqual({ x: 0, y: 0 });
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(
      1,
    );
  });

  test('a long press on a note shows no menu and selects no text', async ({ page }) => {
    await openEditor(page, 'cde');
    const prevented = await page
      .locator('[data-kind="note-target"]')
      .first()
      .evaluate(
        (el) =>
          !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
      );
    expect(prevented).toBe(true);
    expect(await page.locator('.sheet-svg').evaluate((el) => getComputedStyle(el).userSelect)).toBe(
      'none',
    );
    expect(
      await page.getByLabel('Song title').evaluate((el) => getComputedStyle(el).userSelect),
    ).toBe('text');
    const { x, y } = await center(page, 1);
    await longPress(page, x, y, 900);
    expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');
  });

  test('controls opt out of double-tap zoom, and rapid taps all land', async ({ page }) => {
    await openEditor(page);
    const key = page.getByRole('button', { name: 'Add C4' });
    expect(await key.evaluate((el) => getComputedStyle(el).touchAction)).toBe('manipulation');
    expect(
      await page
        .getByRole('button', { name: 'Undo' })
        .evaluate((el) => getComputedStyle(el).touchAction),
    ).toBe('manipulation');
    for (let i = 0; i < 4; i++) {
      await key.tap();
      await page.waitForTimeout(80);
    }
    await expect(fruits(page)).toHaveCount(4);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  });

  test('a tapped fruit key does not stay highlighted', async ({ page }, testInfo) => {
    onlyOn(testInfo, 'iphone');
    await openEditor(page);
    const key = page.getByRole('button', { name: 'Add A4' });
    await key.tap();
    await expect(fruits(page)).toHaveCount(1);
    await expect
      .poll(() => key.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgb(255, 255, 255)');
  });

  test('text fields are at least 16px, so iOS does not zoom in on focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/new');
    for (const label of ['Song title', 'Time signature']) {
      const size = await page
        .getByLabel(label)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(16);
    }
  });
});

test.describe('blank sheet margin', () => {
  test('a swipe from the margin scrolls and keeps the selection', async ({ page }, testInfo) => {
    onlyOn(testInfo, 'iphone');
    await openEditor(page, 'cdefgabc'.repeat(5));
    await settleSheetAt(page, 0);
    await noteButton(page, 2).tap();
    await expect(noteButton(page, 2)).toHaveAccessibleName(/selected$/);
    await settleSheetAt(page, 0);
    const sheet = await rect(page, '.sheet-scroll');
    const x = sheet.left + 4;
    const y = sheet.top + sheet.height * 0.75;
    await swipe(page, x, y, y - 200);
    await expect.poll(() => sheetScrollTop(page)).toBeGreaterThan(50);
    await expect(noteButton(page, 2)).toHaveAccessibleName(/, selected$/);
  });

  test('a tap on the margin lets go of the note', async ({ page }, testInfo) => {
    onlyOn(testInfo, 'iphone');
    await openEditor(page, 'cde');
    await noteButton(page, 2).tap();
    await expect(noteButton(page, 2)).toHaveAccessibleName(/selected$/);
    const sheet = await rect(page, '.sheet-scroll');
    await page.touchscreen.tap(sheet.left + 4, sheet.top + sheet.height / 2);
    await expect(noteButton(page, 2)).toHaveAccessibleName('Note 2: D, quarter note');
  });
});

test.describe('note size and rotation', () => {
  test('on a phone every note column is at least 40px wide, and still drags', async ({
    page,
  }, testInfo) => {
    onlyOn(testInfo, 'iphone');
    await page.setViewportSize({ width: 390, height: 844 });
    await openEditor(page, 'cdefgabc'.repeat(3));
    await settleSheetAt(page, 0);
    const widths = await page
      .locator('[data-kind="note-target"]')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(widths).toHaveLength(24);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(40);
    await noteButton(page, 5).tap();
    await expect(noteButton(page, 5)).toHaveAccessibleName(/selected$/);
    const { x, y, space } = await center(page, 5);
    await swipe(page, x, y, y - space);
    await expect.poll(() => pitchOf(page, 5)).toBe('B');
  });

  test('a tablet keeps the full paper width', async ({ page }, testInfo) => {
    onlyOn(testInfo, 'ipad');
    await page.setViewportSize({ width: 820, height: 1180 });
    await openEditor(page, 'cde');
    const viewWidth = await page
      .locator('.sheet-svg')
      .evaluate((el) => (el as unknown as SVGSVGElement).viewBox.baseVal.width);
    expect(viewWidth).toBeCloseTo(215.9);
  });

  const rotations = {
    ipad: {
      from: { width: 820, height: 1180 },
      to: { width: 1180, height: 820 },
      notes: 30,
      n: 28,
    },
    iphone: {
      from: { width: 390, height: 844 },
      to: { width: 844, height: 390 },
      notes: 24,
      n: 20,
    },
  } as const;
  for (const [project, r] of Object.entries(rotations)) {
    test(`rotating keeps the selected note on screen (${project})`, async ({ page }, testInfo) => {
      onlyOn(testInfo, project);
      await page.setViewportSize(r.from);
      await openEditor(page, 'cdefgab'.repeat(5).slice(0, r.notes));
      await settleSheetAt(page, 'bottom');
      await noteButton(page, r.n).scrollIntoViewIfNeeded();
      await noteButton(page, r.n).tap();
      await expect(noteButton(page, r.n)).toHaveAccessibleName(/selected$/);
      await page.setViewportSize(r.to);
      await expect
        .poll(async () => {
          const s = await rect(page, '.sheet-scroll');
          const box = await noteButton(page, r.n).boundingBox();
          return !!box && box.y < s.bottom && box.y + box.height > s.top;
        })
        .toBe(true);
    });
  }
});
