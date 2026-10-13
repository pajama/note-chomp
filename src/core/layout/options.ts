export type Paper = 'letter' | 'a4';
export type NoteLabels = 'letter' | 'solfege' | 'none';

export interface RenderOptions {
  paper: Paper;
  /** Distance between staff lines in mm. */
  staffSpaceMm: number;
  /** Experimental: bigger fruit for longer notes. */
  sizeByDuration: boolean;
  noteLabels: NoteLabels;
  showLegend: boolean;
  showTrebleClef: boolean;
  showMeasureNumbers: boolean;
}

export const STAFF_SIZES = { large: 6.5, jumbo: 9 } as const;

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  paper: 'letter',
  staffSpaceMm: STAFF_SIZES.large,
  sizeByDuration: false,
  noteLabels: 'letter',
  showLegend: true,
  showTrebleClef: false,
  showMeasureNumbers: false,
};

export const PAPER_SIZES_MM: Record<Paper, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};

export const PAGE_MARGIN_MM = 12.7;
