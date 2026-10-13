import type { Duration } from '../model/types';

/** All values in staff spaces unless the name says Mm. */
export const METRICS = {
  monsterWidth: 3.4,
  monsterHeight: 4.08,
  monsterGap: 0.8,
  clefWidth: 2.2,
  fruitSize: 0.92,
  noteLead: 0.75,
  stemLength: 3.3,
  stemWidth: 0.14,
  ledgerExtension: 0.45,
  ledgerWidth: 0.16,
  staffLineWidth: 0.1,
  barLineWidth: 0.14,
  beamThickness: 0.45,
  flagSize: 1.0,
  dotRadius: 0.16,
  dotGap: 0.3,
  advance: { e: 1.9, q: 2.4, h: 3.2, w: 4.4 } as Readonly<Record<Duration, number>>,
  dottedExtra: 0.5,
  barPadding: 1.0,
  measureEndPadding: 0.4,
  systemEndPadding: 0.6,
  above: 2.8,
  below: 4.3,
  systemGap: 0.4,
  labelBaselineBelow: 3.95,
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
