import type { LayoutResult, StaffItem, SystemLayout } from './types';

/** Width of a gap target, in staff spaces. Fruit start 0.2 spaces right of their slot. */
export const GAP_TARGET_SPACES = 0.4;
/** Note columns reach this far above the top staff line / below the bottom line (spaces). */
export const TARGET_ABOVE_SPACES = 3;
export const TARGET_BELOW_SPACES = 4;

interface Box {
  systemIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Click here to select event `eventIndex`. */
export interface NoteTarget extends Box {
  eventIndex: number;
}
/** Click here to put the insert cursor at gap `index` (0..events.length). */
export interface GapTarget extends Box {
  index: number;
}
export interface PageHitTargets {
  pageIndex: number;
  notes: NoteTarget[];
  gaps: GapTarget[];
}

export function systemStaff(system: SystemLayout): StaffItem {
  const staff = system.items.find((item): item is StaffItem => item.kind === 'staff');
  if (!staff) throw new Error(`System ${system.index} has no staff`);
  return staff;
}

function systemTargets(system: SystemLayout): { notes: NoteTarget[]; gaps: GapTarget[] } {
  const staff = systemStaff(system);
  const s = staff.spacing;
  const half = (GAP_TARGET_SPACES * s) / 2;
  const y = system.staffTop - TARGET_ABOVE_SPACES * s;
  const height = (TARGET_ABOVE_SPACES + 4 + TARGET_BELOW_SPACES) * s;
  const box = (x1: number, x2: number) => ({
    systemIndex: system.index,
    x: x1,
    y,
    width: Math.max(0, x2 - x1),
    height,
  });
  const slots = [...system.slots].sort((a, b) => a.x - b.x);
  const notes: NoteTarget[] = [];
  const gaps: GapTarget[] = [];
  slots.forEach((slot, k) => {
    const end = k + 1 < slots.length ? slots[k + 1].x : system.endX;
    gaps.push({ index: slot.eventIndex, ...box(slot.x - half, slot.x + half) });
    notes.push({ eventIndex: slot.eventIndex, ...box(slot.x + half, end - half) });
  });
  const last = slots[slots.length - 1];
  const trailingStart = last ? system.endX - half : system.startX;
  gaps.push({
    index: last ? last.eventIndex + 1 : 0,
    ...box(trailingStart, staff.x + staff.width),
  });
  return { notes, gaps };
}

/** Pointer targets for the editor: a full-height column per event, and narrow columns between them. */
export function editorHitTargets(result: LayoutResult): PageHitTargets[] {
  return result.pages.map((page) => {
    const notes: NoteTarget[] = [];
    const gaps: GapTarget[] = [];
    for (const system of page.systems) {
      const targets = systemTargets(system);
      notes.push(...targets.notes);
      gaps.push(...targets.gaps);
    }
    return { pageIndex: page.index, notes, gaps };
  });
}

export interface MeasureBox {
  pageIndex: number;
  systemIndex: number;
  x: number;
  width: number;
  staffTop: number;
  spacing: number;
}

/** Where measure `measureNumber` (1-based) sits, or undefined if the layout has no such measure. */
export function measureBox(result: LayoutResult, measureNumber: number): MeasureBox | undefined {
  for (const page of result.pages) {
    for (const system of page.systems) {
      const bars = system.items.flatMap((item) => (item.kind === 'barLine' ? [item.x] : []));
      const k = measureNumber - system.firstMeasure;
      if (k < 0 || k >= bars.length) continue;
      const x = k === 0 ? system.startX : bars[k - 1];
      return {
        pageIndex: page.index,
        systemIndex: system.index,
        x,
        width: bars[k] - x,
        staffTop: system.staffTop,
        spacing: systemStaff(system).spacing,
      };
    }
  }
  return undefined;
}
