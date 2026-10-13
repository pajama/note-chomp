# Phase 1b — Core helpers: hit targets & compact sheet (Tasks 3–4)

Both tasks are pure TypeScript in `src/core` (no React, no DOM). Read `00-index.md` → Global Constraints first.

### Task 3: Editor hit targets & measure boxes

**Files:**
- Create: `src/core/layout/hitTargets.ts`
- Test: `src/core/layout/hitTargets.test.ts`

**Interfaces:**
- Consumes: `LayoutResult`, `SystemLayout`, `StaffItem` (`src/core/layout/types.ts`). Facts used: each system has exactly one `staff` item (`x`, `width`, `spacing` = staff space in mm); `system.slots` hold the x where each event's slot starts (fruit centre = slot x + 0.8 spaces, fruit half-width 0.6 spaces, so fruit start ≥ slot x + 0.2 spaces); `system.endX` is the last bar line; bar lines are `barLine` items in measure order; `system.firstMeasure` is 1-based.
- Produces (used by Tasks 4, 13, 14):
  - `GAP_TARGET_SPACES = 0.4`, `TARGET_ABOVE_SPACES = 3`, `TARGET_BELOW_SPACES = 4`
  - `interface NoteTarget { eventIndex: number; systemIndex: number; x: number; y: number; width: number; height: number }`
  - `interface GapTarget { index: number; systemIndex: number; x: number; y: number; width: number; height: number }` — `index` is the insert gap 0..events.length
  - `interface PageHitTargets { pageIndex: number; notes: NoteTarget[]; gaps: GapTarget[] }`
  - `systemStaff(system: SystemLayout): StaffItem`
  - `editorHitTargets(result: LayoutResult): PageHitTargets[]` — one entry per page, page coordinates (mm). Note columns span staff top − 3 spaces … bottom line + 4 spaces (11 spaces tall) and run from just after their slot's gap to just before the next slot's gap (last one: to `endX`). Gap columns are 0.4 spaces wide, centred on each slot x; each system also gets a trailing gap from `endX` to the end of the staff (index = last event + 1; an empty system gets gap 0 from `startX`).
  - `interface MeasureBox { pageIndex: number; systemIndex: number; x: number; width: number; staffTop: number; spacing: number }`
  - `measureBox(result: LayoutResult, measureNumber: number): MeasureBox | undefined` — measure 1-based; undefined if not laid out.

- [ ] **Step 1: Write the failing test**

**Create `src/core/layout/hitTargets.test.ts`:**

```ts
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
      expect(fruit.x - fruit.size / 2).toBeGreaterThanOrEqual(target.x);
      expect(fruit.x + fruit.size / 2).toBeLessThanOrEqual(target.x + target.width);
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/layout/hitTargets.test.ts`
Expected: FAIL — `Failed to resolve import "./hitTargets"`.

- [ ] **Step 3: Implement**

**Create `src/core/layout/hitTargets.ts`:**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/layout`
Expected: PASS (6 new tests, all existing layout tests still pass).

- [ ] **Step 5: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/core/layout/hitTargets.ts src/core/layout/hitTargets.test.ts
git commit -m "feat(layout): editor hit targets and measure boxes"
```

---

### Task 4: Compact on-screen sheet

**Files:**
- Create: `src/core/layout/compact.ts`
- Modify: `src/core/layout/index.ts` (public barrel)
- Test: `src/core/layout/compact.test.ts`

**Interfaces:**
- Consumes: `METRICS.above`, `METRICS.systemGap`, `systemBandMm(spacing)` from `src/core/layout/metrics.ts` (a system's band runs from `staffTop − above·s` and is `systemBandMm(s)` tall); `LayoutResult`, `SystemLayout`; Task 3's exports.
- Produces (used by Tasks 13, 14):
  - `COMPACT_PADDING_MM = 2`
  - `interface CompactSystem { pageIndex: number; system: SystemLayout; offsetY: number }` — add `offsetY` to a page y to get the compact-sheet y.
  - `interface CompactSheet { width: number; height: number; systems: CompactSystem[] }` — width = page width.
  - `compactSheet(result: LayoutResult, spacing: number): CompactSheet` — every system of every page, in order, stacked with `systemGap` between bands and `COMPACT_PADDING_MM` above/below; no title, legend or margins.
  - `src/core/layout/index.ts` re-exports `compactSheet`, `COMPACT_PADDING_MM`, `CompactSheet`, `CompactSystem`, `editorHitTargets`, `measureBox`, `systemStaff`, `GapTarget`, `MeasureBox`, `NoteTarget`, `PageHitTargets` (other layers import only from the barrel).

- [ ] **Step 1: Write the failing test**

**Create `src/core/layout/compact.test.ts`:**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/layout/compact.test.ts`
Expected: FAIL — `Failed to resolve import "./compact"`.

- [ ] **Step 3: Implement**

**Create `src/core/layout/compact.ts`:**

```ts
import { METRICS, systemBandMm } from './metrics';
import type { LayoutResult, SystemLayout } from './types';

/** Space above the first and below the last system on screen, in mm. */
export const COMPACT_PADDING_MM = 2;

export interface CompactSystem {
  pageIndex: number;
  system: SystemLayout;
  /** Add to a page y to get the y on the compact sheet. */
  offsetY: number;
}

export interface CompactSheet {
  width: number;
  height: number;
  systems: CompactSystem[];
}

/** The same systems as the printed pages, stacked with no paper margins, title or legend. */
export function compactSheet(result: LayoutResult, spacing: number): CompactSheet {
  const band = systemBandMm(spacing);
  const gap = METRICS.systemGap * spacing;
  const systems: CompactSystem[] = [];
  for (const page of result.pages) {
    for (const system of page.systems) {
      const top = COMPACT_PADDING_MM + systems.length * (band + gap);
      systems.push({
        pageIndex: page.index,
        system,
        offsetY: top - (system.staffTop - METRICS.above * spacing),
      });
    }
  }
  const n = systems.length;
  return {
    width: result.pages[0]?.width ?? 0,
    height: 2 * COMPACT_PADDING_MM + n * band + Math.max(0, n - 1) * gap,
    systems,
  };
}
```

**Replace `src/core/layout/index.ts` with:**

```ts
export { layoutSong, InvalidSongLayoutError } from './page';
export * from './options';
export type * from './types';
export { cursorPosition, type CursorPosition } from './cursor';
export { compactSheet, COMPACT_PADDING_MM, type CompactSheet, type CompactSystem } from './compact';
export {
  editorHitTargets,
  measureBox,
  systemStaff,
  type GapTarget,
  type MeasureBox,
  type NoteTarget,
  type PageHitTargets,
} from './hitTargets';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/layout`
Expected: PASS (3 new tests).

- [ ] **Step 5: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/core/layout/compact.ts src/core/layout/compact.test.ts src/core/layout/index.ts
git commit -m "feat(layout): compact on-screen sheet of stacked systems"
```
