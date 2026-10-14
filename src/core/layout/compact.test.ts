import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../model/factories';
import { COMPACT_PADDING_MM, compactSheet } from './compact';
import { METRICS, systemBandMm } from './metrics';
import { DEFAULT_RENDER_OPTIONS, PAPER_SIZES_MM } from './options';
import { layoutSong } from './page';

const s = DEFAULT_RENDER_OPTIONS.staffSpaceMm;
const long = {
  ...createEmptySong('Long'),
  events: Array.from({ length: 120 }, () => note('E', 4, 'q')),
};

describe('compactSheet', () => {
  it('stacks every system of every page, in order, with no page margins', () => {
    const layout = layoutSong(long);
    const sheet = compactSheet(layout, s);
    const total = layout.pages.reduce((n, p) => n + p.systems.length, 0);
    expect(sheet.systems).toHaveLength(total);
    expect(sheet.systems.map((c) => c.system.index)).toEqual([...Array(total).keys()]);
    expect(sheet.width).toBe(PAPER_SIZES_MM.letter.width);

    const band = systemBandMm(s);
    const gap = METRICS.systemGap * s;
    sheet.systems.forEach((c, i) => {
      const top = c.system.staffTop + c.offsetY - METRICS.above * s;
      expect(top).toBeCloseTo(COMPACT_PADDING_MM + i * (band + gap));
    });
    expect(sheet.height).toBeCloseTo(2 * COMPACT_PADDING_MM + total * band + (total - 1) * gap);
  });

  it('remembers which page each system came from', () => {
    const layout = layoutSong(long);
    const sheet = compactSheet(layout, s);
    const firstOfPage2 = sheet.systems.find((c) => c.pageIndex === 1);
    expect(firstOfPage2?.system).toBe(layout.pages[1].systems[0]);
  });

  it('is one system tall for an empty song', () => {
    const sheet = compactSheet(layoutSong(createEmptySong()), s);
    expect(sheet.systems).toHaveLength(1);
    expect(sheet.height).toBeCloseTo(2 * COMPACT_PADDING_MM + systemBandMm(s));
  });
});
