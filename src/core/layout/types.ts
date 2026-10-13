import type { Duration, Octave, Pitch } from '../model/types';

export interface StaffItem {
  kind: 'staff';
  x: number;
  y: number;
  width: number;
  spacing: number;
  lineWidth: number;
}
export interface MonsterItem {
  kind: 'monster';
  x: number;
  y: number;
  width: number;
  height: number;
}
/** y = the G line (second line from bottom). */
export interface ClefItem {
  kind: 'clef';
  x: number;
  y: number;
  spacing: number;
}
/** x, y = center of the fruit; size = diameter of the fruit's 1×1 box in mm. */
export interface FruitItem {
  kind: 'fruit';
  pitch: Pitch;
  octave: Octave;
  x: number;
  y: number;
  size: number;
  hollow: boolean;
  eventIndex: number;
}
export interface StemItem {
  kind: 'stem';
  x: number;
  y1: number;
  y2: number;
  width: number;
  color: string;
}
/** x, y = stem tip. */
export interface FlagItem {
  kind: 'flag';
  x: number;
  y: number;
  direction: 'up' | 'down';
  size: number;
  color: string;
}
/** y1/y2 = stem-tip line; the beam's thickness extends from there toward the notes (down for 'up' stems). */
export interface BeamItem {
  kind: 'beam';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  color: string;
  direction: 'up' | 'down';
}
export interface LedgerItem {
  kind: 'ledger';
  x1: number;
  x2: number;
  y: number;
  width: number;
}
export interface DotItem {
  kind: 'dot';
  x: number;
  y: number;
  r: number;
  color: string;
}
/** y = middle staff line. */
export interface RestItem {
  kind: 'rest';
  duration: Duration;
  x: number;
  y: number;
  spacing: number;
  eventIndex: number;
}
export interface BarLineItem {
  kind: 'barLine';
  x: number;
  y1: number;
  y2: number;
  final: boolean;
  width: number;
}
export interface LabelItem {
  kind: 'label';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  anchor: 'start' | 'middle' | 'end';
  weight: 'normal' | 'bold';
}
export interface LegendItem {
  kind: 'legend';
  x: number;
  y: number;
  width: number;
  height: number;
  labels: 'letter' | 'solfege';
}

export type LayoutItem =
  | StaffItem
  | MonsterItem
  | ClefItem
  | FruitItem
  | StemItem
  | FlagItem
  | BeamItem
  | LedgerItem
  | DotItem
  | RestItem
  | BarLineItem
  | LabelItem
  | LegendItem;

/** Where event `eventIndex` starts horizontally — used for the editor cursor. */
export interface SlotPosition {
  eventIndex: number;
  x: number;
}

export interface SystemLayout {
  index: number;
  /** y of the top staff line. */
  staffTop: number;
  firstMeasure: number;
  /** x where the first measure begins (after monster/clef). */
  startX: number;
  /** x of the last bar line (or startX for an empty system). */
  endX: number;
  items: LayoutItem[];
  slots: SlotPosition[];
}

export interface PageLayout {
  index: number;
  width: number;
  height: number;
  /** Page-level items (title, legend). System items live in `systems`. */
  items: LayoutItem[];
  systems: SystemLayout[];
}

export interface LayoutResult {
  pages: PageLayout[];
}
