import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../model/factories';
import type { MusicEvent, Song } from '../model/types';
import { DEFAULT_RENDER_OPTIONS, layoutSong, InvalidSongLayoutError, STAFF_SIZES } from './index';

function song(events: MusicEvent[]): Song {
  return { ...createEmptySong('Test Song'), id: 'fixed', events };
}

const wholeNotes = (count: number) => Array.from({ length: count }, () => note('C', 5, 'w'));

const hotCrossBuns = [
  note('E', 4, 'q'),
  note('D', 4, 'q'),
  note('C', 4, 'h'),
  note('E', 4, 'q'),
  note('D', 4, 'q'),
  note('C', 4, 'h'),
  ...(['C', 'C', 'C', 'C', 'D', 'D', 'D', 'D'] as const).map((p) => note(p, 4, 'e')),
  note('E', 4, 'q'),
  note('D', 4, 'q'),
  note('C', 4, 'h'),
];

describe('layoutSong', () => {
  it('lays out an empty song as one page with one empty staff', () => {
    const result = layoutSong(song([]));
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].systems).toHaveLength(1);
    expect(result.pages[0].width).toBeCloseTo(215.9);
  });

  it('adds the title and legend as page items', () => {
    const [page] = layoutSong(song([])).pages;
    expect(page.items.map((i) => i.kind)).toEqual(['label', 'legend']);
    expect(page.items[0]).toMatchObject({ text: 'Test Song', anchor: 'middle' });
  });

  it('omits the legend when disabled', () => {
    const [page] = layoutSong(song([]), { ...DEFAULT_RENDER_OPTIONS, showLegend: false }).pages;
    expect(page.items.map((i) => i.kind)).toEqual(['label']);
  });

  it('puts Hot Cross Buns on three systems with a single final bar line', () => {
    // widths (staff spaces): 9.4, 9.4, 16.6 (eight eighths), 9.4; ~24.5 available per system
    const result = layoutSong(song(hotCrossBuns));
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].systems.map((s) => s.firstMeasure)).toEqual([1, 3, 4]);
    const finals = result.pages[0].systems
      .flatMap((s) => s.items)
      .filter((i) => i.kind === 'barLine' && i.final);
    expect(finals).toHaveLength(1);
  });

  it('fits three Large systems per Letter page and continues titles on later pages', () => {
    const result = layoutSong(song(wholeNotes(16)));
    expect(result.pages[0].systems).toHaveLength(3);
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages[1].items[0]).toMatchObject({ text: 'Test Song (page 2)' });
  });

  it('fits two Jumbo systems per page', () => {
    const result = layoutSong(song(wholeNotes(16)), {
      ...DEFAULT_RENDER_OPTIONS,
      staffSpaceMm: STAFF_SIZES.jumbo,
    });
    expect(result.pages[0].systems).toHaveLength(2);
  });

  it('keeps every system inside the page', () => {
    for (const page of layoutSong(song(wholeNotes(30))).pages) {
      for (const system of page.systems) {
        expect(system.staffTop).toBeGreaterThan(0);
        expect(system.staffTop + 4 * DEFAULT_RENDER_OPTIONS.staffSpaceMm).toBeLessThan(page.height);
        expect(system.endX).toBeLessThanOrEqual(page.width - 12.7 + 0.001);
      }
    }
  });

  it('does not stretch a short final system', () => {
    const [page] = layoutSong(song([note('C', 4, 'q')])).pages;
    expect(page.systems[0].endX).toBeLessThan(page.width / 2);
  });

  it('throws on a song with a bar-crossing note', () => {
    expect(() => layoutSong(song([note('C', 4, 'h', true), note('D', 4, 'h')]))).toThrow(
      InvalidSongLayoutError,
    );
  });

  it('is deterministic', () => {
    expect(layoutSong(song(hotCrossBuns))).toEqual(layoutSong(song(hotCrossBuns)));
  });
});
