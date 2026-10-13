import type { Duration } from '../model/types';

/** All values in staff spaces unless the name says Mm. */
export const METRICS = {
  monsterWidth: 3.4,
  monsterHeight: 4.08,
  monsterGap: 0.8,
  clefWidth: 2.2,
  fruitSize: 1.2,
  noteLead: 0.8,
  stemLength: 3.3,
  stemWidth: 0.14,
  ledgerExtension: 0.3,
  ledgerWidth: 0.16,
  staffLineWidth: 0.1,
  barLineWidth: 0.14,
  beamThickness: 0.45,
  flagSize: 0.8,
  /** How far right of the stem the flag glyph reaches, as a fraction of flagSize (FlagGlyph path max x). */
  flagReach: 0.83,
  dotRadius: 0.16,
  dotGap: 0.3,
  advance: { e: 2.1, q: 2.6, h: 3.4, w: 4.6 } as Readonly<Record<Duration, number>>,
  dottedExtra: 0.4,
  barPadding: 0.8,
  measureEndPadding: 0.3,
  systemEndPadding: 0.6,
  above: 2.8,
  below: 4.3,
  systemGap: 0.4,
  labelBaselineBelow: 4.05,
  labelFontSize: 0.8,
  measureNumberFontSize: 0.6,
  sizeByDurationScale: { e: 0.8, q: 1, h: 1.15, w: 1.3 } as Readonly<Record<Duration, number>>,
} as const;

export const TITLE_HEIGHT_MM = 14;
export const TITLE_FONT_MM = 8;
export const LEGEND_HEIGHT_MM = 18;
/** The last system is only stretched to full width if it is at least this full. */
export const LAST_SYSTEM_JUSTIFY_THRESHOLD = 0.75;

export function stepY(staffTop: number, spacing: number, step: number): number {
  return staffTop + 4 * spacing - (step * spacing) / 2;
}

export function systemBandMm(spacing: number): number {
  return (METRICS.above + 4 + METRICS.below) * spacing;
}
