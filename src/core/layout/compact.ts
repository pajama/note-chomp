import { METRICS, systemBandMm } from './metrics';
import type { LayoutResult, SystemLayout } from './types';

/** Space above the first and below the last system on screen, in mm. */
export const COMPACT_PADDING_MM = 2;

export interface CompactSystem {
  pageIndex: number;
  system: SystemLayout;
  /** Add to a page y to get the y on the compact sheet. */
  offsetY: number;
}

export interface CompactSheet {
  width: number;
  height: number;
  systems: CompactSystem[];
}

/** The same systems as the printed pages, stacked with no paper margins, title or legend. */
export function compactSheet(result: LayoutResult, spacing: number): CompactSheet {
  const band = systemBandMm(spacing);
  const gap = METRICS.systemGap * spacing;
  const systems: CompactSystem[] = [];
  for (const page of result.pages) {
    for (const system of page.systems) {
      const top = COMPACT_PADDING_MM + systems.length * (band + gap);
      systems.push({
        pageIndex: page.index,
        system,
        offsetY: top - (system.staffTop - METRICS.above * spacing),
      });
    }
  }
  const n = systems.length;
  return {
    width: result.pages[0]?.width ?? 0,
    height: 2 * COMPACT_PADDING_MM + n * band + Math.max(0, n - 1) * gap,
    systems,
  };
}
