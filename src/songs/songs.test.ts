import { describe, expect, it } from 'vitest';
import { DEFAULT_RENDER_OPTIONS, layoutSong, STAFF_SIZES, type LayoutResult } from '../core/layout';
import { BUNDLED_SONGS, isBuiltinId } from './index';

/** Compact, reviewable digest of a layout — catches geometry regressions without megabyte snapshots. */
function digest(result: LayoutResult) {
  const r = (n: number) => Math.round(n * 100) / 100;
  return result.pages.map((page) => ({
    pageItems: page.items.map((i) => i.kind),
    systems: page.systems.map((system) => ({
      firstMeasure: system.firstMeasure,
      staffTop: r(system.staffTop),
      fruit: system.items.flatMap((i) =>
        i.kind === 'fruit'
          ? [`${i.pitch}${i.octave}@${r(i.x)},${r(i.y)}${i.hollow ? 'o' : ''}`]
          : [],
      ),
      beams: system.items.filter((i) => i.kind === 'beam').length,
      ledgers: system.items.filter((i) => i.kind === 'ledger').length,
      clefs: system.items.filter((i) => i.kind === 'clef').length,
      /** Note names and measure numbers, in drawing order. */
      labels: system.items.flatMap((i) => (i.kind === 'label' ? [i.text] : [])),
    })),
  }));
}

describe('bundled songs', () => {
  it('ships the eight starter songs', () => {
    expect(BUNDLED_SONGS.map((s) => s.title)).toEqual([
      'Au Clair de la Lune',
      'Hot Cross Buns',
      'Jingle Bells',
      'London Bridge',
      'Mary Had a Little Lamb',
      'Ode to Joy',
      'Old MacDonald',
      'Twinkle Twinkle Little Star',
    ]);
  });

  it('uses stable builtin ids', () => {
    expect(BUNDLED_SONGS.find((s) => s.title === 'Hot Cross Buns')?.id).toBe(
      'builtin-hot-cross-buns',
    );
    expect(BUNDLED_SONGS.every((s) => isBuiltinId(s.id))).toBe(true);
    expect(isBuiltinId('3f2a…')).toBe(false);
  });

  it('fits every song on two Letter pages at Large (Jingle Bells, the longest, on three)', () => {
    for (const song of BUNDLED_SONGS) {
      const limit = song.title === 'Jingle Bells' ? 3 : 2;
      expect(layoutSong(song).pages.length, song.title).toBeLessThanOrEqual(limit);
    }
  });

  for (const song of BUNDLED_SONGS) {
    it(`${song.title} lays out the same as last time (default)`, () => {
      expect(digest(layoutSong(song))).toMatchSnapshot();
    });
    it(`${song.title} lays out the same as last time (jumbo, solfège, size-by-duration)`, () => {
      const options = {
        ...DEFAULT_RENDER_OPTIONS,
        staffSpaceMm: STAFF_SIZES.jumbo,
        noteLabels: 'solfege' as const,
        sizeByDuration: true,
      };
      expect(digest(layoutSong(song, options))).toMatchSnapshot();
    });
    it(`${song.title} lays out the same as last time (A4, treble clef, measure numbers, no legend)`, () => {
      const options = {
        ...DEFAULT_RENDER_OPTIONS,
        paper: 'a4' as const,
        showTrebleClef: true,
        showMeasureNumbers: true,
        showLegend: false,
      };
      expect(digest(layoutSong(song, options))).toMatchSnapshot();
    });
  }
});
