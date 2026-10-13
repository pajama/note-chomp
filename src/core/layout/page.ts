import type { Song } from '../model/types';
import { NEUTRAL } from '../palette/palette';
import { splitIntoMeasures } from '../theory/rhythm';
import { labelItem } from './builders';
import {
  LAST_SYSTEM_JUSTIFY_THRESHOLD,
  LEGEND_HEIGHT_MM,
  METRICS,
  systemBandMm,
  TITLE_FONT_MM,
  TITLE_HEIGHT_MM,
} from './metrics';
import {
  DEFAULT_RENDER_OPTIONS,
  PAGE_MARGIN_MM,
  PAPER_SIZES_MM,
  type RenderOptions,
} from './options';
import { breakIntoSystems, measureWidth } from './spacing';
import { layoutSystem } from './system';
import type { LayoutItem, LayoutResult, PageLayout } from './types';

export class InvalidSongLayoutError extends Error {
  override name = 'InvalidSongLayoutError';
}

export function layoutSong(
  song: Song,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): LayoutResult {
  const split = splitIntoMeasures(song.events, song.timeSignature);
  if (!split.ok) throw new InvalidSongLayoutError(split.error.message);
  const measures = split.value;

  const paper = PAPER_SIZES_MM[options.paper];
  const s = options.staffSpaceMm;
  const left = PAGE_MARGIN_MM;
  const width = paper.width - 2 * PAGE_MARGIN_MM;

  const headerSpaces =
    METRICS.monsterWidth + METRICS.monsterGap + (options.showTrebleClef ? METRICS.clefWidth : 0);
  const availableSpaces = width / s - headerSpaces - METRICS.systemEndPadding;
  const widths = measures.map(measureWidth);
  const groups = measures.length > 0 ? breakIntoSystems(widths, availableSpaces) : [[]];

  const band = systemBandMm(s);
  const gap = METRICS.systemGap * s;
  const legendHeight = options.showLegend ? LEGEND_HEIGHT_MM : 0;
  const contentTop = PAGE_MARGIN_MM + TITLE_HEIGHT_MM;
  const availableHeight = paper.height - 2 * PAGE_MARGIN_MM - TITLE_HEIGHT_MM - legendHeight;
  const perPage = Math.max(1, Math.floor((availableHeight + gap) / (band + gap)));

  const pages: PageLayout[] = [];
  for (let start = 0, pageIndex = 0; start < groups.length; start += perPage, pageIndex++) {
    const systems = groups.slice(start, start + perPage).map((group, k) => {
      const systemIndex = start + k;
      const isFinalSystem = systemIndex === groups.length - 1;
      const natural = group.reduce((sum, i) => sum + widths[i], 0);
      const justify = !(isFinalSystem && natural < availableSpaces * LAST_SYSTEM_JUSTIFY_THRESHOLD);
      return layoutSystem({
        index: systemIndex,
        measures: group.map((i) => measures[i]),
        timeSignature: song.timeSignature,
        staffTop: contentTop + k * (band + gap) + METRICS.above * s,
        left,
        width,
        spacing: s,
        options,
        justify,
        isFinalSystem,
      });
    });

    const title = pageIndex === 0 ? song.title : `${song.title} (page ${pageIndex + 1})`;
    const items: LayoutItem[] = [
      labelItem(
        title,
        paper.width / 2,
        PAGE_MARGIN_MM + TITLE_FONT_MM,
        TITLE_FONT_MM,
        NEUTRAL.ink,
        'middle',
        'bold',
      ),
    ];
    if (options.showLegend) {
      items.push({
        kind: 'legend',
        x: left,
        y: paper.height - PAGE_MARGIN_MM - LEGEND_HEIGHT_MM,
        width,
        height: LEGEND_HEIGHT_MM,
        labels: options.noteLabels === 'solfege' ? 'solfege' : 'letter',
      });
    }
    pages.push({ index: pageIndex, width: paper.width, height: paper.height, items, systems });
  }
  return { pages };
}
