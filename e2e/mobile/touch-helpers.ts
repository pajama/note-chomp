import { expect, noteButton, type Page } from '../fixtures';

type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';

/** Real touch events through CDP, so the browser may scroll, zoom or select in response. */
async function touches(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: TouchType, x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  return { send, detach: () => cdp.detach() };
}

const STEPS = 12;

/** A one-finger swipe from (x, fromY) to (toX, toY). */
export async function swipe(
  page: Page,
  x: number,
  fromY: number,
  toY: number,
  toX: number = x,
): Promise<void> {
  const t = await touches(page);
  await t.send('touchStart', x, fromY);
  for (let i = 1; i <= STEPS; i++) {
    await t.send('touchMove', x + ((toX - x) * i) / STEPS, fromY + ((toY - fromY) * i) / STEPS);
  }
  await t.send('touchEnd', toX, toY);
  await t.detach();
}

/** Touch, stay still for `ms`, lift. */
export async function longPress(page: Page, x: number, y: number, ms: number): Promise<void> {
  const t = await touches(page);
  await t.send('touchStart', x, y);
  await page.waitForTimeout(ms);
  await t.send('touchEnd', x, y);
  await t.detach();
}

/** Touch and move, but keep the finger down: call release() to lift it. */
export async function hold(
  page: Page,
  x: number,
  fromY: number,
  toY: number,
): Promise<{ release: () => Promise<void> }> {
  const t = await touches(page);
  await t.send('touchStart', x, fromY);
  for (let i = 1; i <= STEPS; i++)
    await t.send('touchMove', x, fromY + ((toY - fromY) * i) / STEPS);
  return {
    release: async () => {
      await t.send('touchEnd', x, toY);
      await t.detach();
    },
  };
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export async function rect(page: Page, selector: string, index = 0): Promise<Rect> {
  return page
    .locator(selector)
    .nth(index)
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    });
}

export const windowScroll = (page: Page) =>
  page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

export const sheetScrollTop = (page: Page) =>
  page.getByTestId('song-pages').evaluate((el) => el.scrollTop);

/** Centre of note n's column, plus one staff space in px (a column is 11 spaces tall). */
export async function center(page: Page, n: number) {
  const box = await noteButton(page, n).boundingBox();
  if (!box) throw new Error(`note ${n} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, space: box.height / 11 };
}

/** Wait out the smooth scroll that follows typing, then put the sheet at `top`. */
export async function settleSheetAt(page: Page, top: number | 'bottom'): Promise<number> {
  let value = 0;
  await expect(async () => {
    value = await page.getByTestId('song-pages').evaluate((el, t) => {
      el.scrollTop = t === 'bottom' ? el.scrollHeight : t;
      return el.scrollTop;
    }, top);
    await page.waitForTimeout(200);
    expect(await sheetScrollTop(page)).toBe(value);
  }).toPass();
  return value;
}

/** No sideways scrolling, and every bar of controls is inside the screen. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const w = window.innerWidth;
    if (document.documentElement.scrollWidth > w) {
      out.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${w}`);
    }
    for (const bar of ['.editor-topbar', '.editor-dock', '.app-header']) {
      for (const el of document.querySelectorAll(`${bar}, ${bar} *`)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // The length row may scroll sideways inside itself; the help popover is checked separately.
        if (el.parentElement?.closest('.duration-picker') || el.closest('.sr-only, #editor-help'))
          continue;
        if (r.left < 0 || r.right > w + 0.5) {
          out.push(`${el.tagName}.${el.className} [${r.left.toFixed(1)}, ${r.right.toFixed(1)}]`);
        }
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
}
