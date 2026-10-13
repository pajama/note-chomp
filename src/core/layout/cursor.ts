import type { LayoutResult } from './types';

export interface CursorPosition {
  pageIndex: number;
  x: number;
  staffTop: number;
  spacing: number;
}

export function cursorPosition(
  result: LayoutResult,
  cursorIndex: number,
  spacing: number,
): CursorPosition {
  for (const page of result.pages) {
    for (const system of page.systems) {
      const slot = system.slots.find((s) => s.eventIndex === cursorIndex);
      if (slot)
        return {
          pageIndex: page.index,
          x: slot.x + 0.15 * spacing,
          staffTop: system.staffTop,
          spacing,
        };
    }
  }
  const lastPage = result.pages[result.pages.length - 1];
  const lastSystem = lastPage.systems[lastPage.systems.length - 1];
  const x =
    lastSystem.slots.length > 0
      ? lastSystem.endX - 0.25 * spacing
      : lastSystem.startX + 0.5 * spacing;
  return { pageIndex: lastPage.index, x, staffTop: lastSystem.staffTop, spacing };
}
