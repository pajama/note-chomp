import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from '../model/factories';
import type { MusicEvent } from '../model/types';
import { editorHitTargets, GAP_TARGET_SPACES, measureBox, systemStaff } from './hitTargets';
import { DEFAULT_RENDER_OPTIONS } from './options';
import { layoutSong } from './page';
import type { FruitItem } from './types';

const s = DEFAULT_RENDER_OPTIONS.staffSpaceMm;
const songOf = (events: MusicEvent[]) => ({ ...createEmptySong('T'), events });
const short = songOf([
  note('C', 4, 'q'),
  note('E', 4, 'q'),
  rest('q'),
  note('G', 4, 'q'),
  note('C', 5, 'h'),
]);

describe('editorHitTargets', () => {
  it('gives every event one full-height column that contains its fruit', () => {
    const layout = layoutSong(short);
    const [page] = editorHitTargets(layout);
    expect(page.notes.map((t) => t.eventIndex)).toEqual([0, 1, 2, 3, 4]);
    const system = layout.pages[0].systems[0];
    for (const fruit of system.items.filter((i): i is FruitItem => i.kind === 'fruit')) {
      const target = page.notes.find((t) => t.eventIndex === fruit.eventIndex)!;
      // The fruit's left edge and the column's left edge are mathematically equal; allow float noise.
      expect(fruit.x - fruit.size / 2).toBeGreaterThanOrEqual(target.x - 1e-9);
      expect(fruit.x + fruit.size / 2).toBeLessThanOrEqual(target.x + target.width + 1e-9);
      expect(target.y).toBeCloseTo(system.staffTop - 3 * s);
      expect(target.height).toBeCloseTo(11 * s);
    }
  });

  it('puts a gap before every event and one after the last, reaching the end of the staff', () => {
    const layout = layoutSong(short);
    const [page] = editorHitTargets(layout);
    expect(page.gaps.map((g) => g.index)).toEqual([0, 1, 2, 3, 4, 5]);
    const staff = systemStaff(layout.pages[0].systems[0]);
    const last = page.gaps[page.gaps.length - 1];
    expect(last.x + last.width).toBeCloseTo(staff.x + staff.width);
    expect(page.gaps[0].width).toBeCloseTo(GAP_TARGET_SPACES * s);
  });

  it('never overlaps a note column with a gap column', () => {
    const [page] = editorHitTargets(layoutSong(short));
    for (const n of page.notes) {
      for (const g of page.gaps) {
        const overlap = Math.min(n.x + n.width, g.x + g.width) - Math.max(n.x, g.x);
        expect(overlap).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it('offers a single gap 0 across an empty staff', () => {
    const [page] = editorHitTargets(layoutSong(songOf([])));
    expect(page.notes).toEqual([]);
    expect(page.gaps.map((g) => g.index)).toEqual([0]);
  });

  it('groups targets by page and system for a long song', () => {
    const many = songOf(Array.from({ length: 120 }, () => note('D', 4, 'q')));
    const layout = layoutSong(many);
    const pages = editorHitTargets(layout);
    expect(pages).toHaveLength(layout.pages.length);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((p) => p.notes).map((t) => t.eventIndex)).toEqual(
      many.events.map((_, i) => i),
    );
    const allGaps = pages.flatMap((p) => p.gaps).map((g) => g.index);
    expect(allGaps[allGaps.length - 1]).toBe(120);
    expect(pages[1].notes[0].systemIndex).toBe(layout.pages[1].systems[0].index);
  });
});

describe('measureBox', () => {
  it('finds a measure between its bar lines', () => {
    const two = songOf([note('C', 4, 'w'), note('D', 4, 'w')]);
    const layout = layoutSong(two);
    const system = layout.pages[0].systems[0];
    const bars = system.items.flatMap((i) => (i.kind === 'barLine' ? [i.x] : []));
    expect(measureBox(layout, 1)).toMatchObject({ pageIndex: 0, systemIndex: 0, x: system.startX });
    expect(measureBox(layout, 2)).toMatchObject({ x: bars[0], width: bars[1] - bars[0] });
    expect(measureBox(layout, 3)).toBeUndefined();
  });
});
