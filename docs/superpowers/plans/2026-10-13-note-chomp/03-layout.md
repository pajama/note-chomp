# Phase 3 — Layout engine (`src/core/layout/`)

The layout engine is the central contract: `layoutSong(song, options) → LayoutResult`. It is pure, deterministic, and produces **millimetre** geometry (y downward). Renderers never do music math.

### Task 7: Layout contract — options, item types, metrics, builders

**Files:**
- Create: `src/core/layout/options.ts`, `src/core/layout/types.ts`, `src/core/layout/metrics.ts`, `src/core/layout/builders.ts`
- Test: `src/core/layout/metrics.test.ts`

**Interfaces:**
- Consumes: `Pitch`, `Octave`, `Duration` (Task 2)
- Produces (exact names used by later tasks):
  - `options.ts`: `Paper`, `NoteLabels`, `RenderOptions`, `STAFF_SIZES`, `DEFAULT_RENDER_OPTIONS`, `PAPER_SIZES_MM`, `PAGE_MARGIN_MM`
  - `types.ts`: `StaffItem`, `MonsterItem`, `ClefItem`, `FruitItem`, `StemItem`, `FlagItem`, `BeamItem`, `LedgerItem`, `DotItem`, `RestItem`, `BarLineItem`, `LabelItem`, `LegendItem`, `LayoutItem`, `SlotPosition`, `SystemLayout`, `PageLayout`, `LayoutResult`
  - `metrics.ts`: `METRICS`, `TITLE_HEIGHT_MM`, `TITLE_FONT_MM`, `LEGEND_HEIGHT_MM`, `LAST_SYSTEM_JUSTIFY_THRESHOLD`, `stepY(staffTop, spacing, step)`, `systemBandMm(spacing)`
  - `builders.ts`: `labelItem(text, x, y, fontSize, color, anchor, weight): LabelItem`

- [ ] **Step 1: Write the failing test**

`src/core/layout/metrics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { METRICS, stepY, systemBandMm } from './metrics';
import { DEFAULT_RENDER_OPTIONS, STAFF_SIZES } from './options';

describe('stepY', () => {
  it('puts step 0 (E4) on the bottom line and step 8 (F5) on the top line', () => {
    expect(stepY(100, 10, 0)).toBe(140);
    expect(stepY(100, 10, 8)).toBe(100);
  });
  it('moves half a space per step', () => {
    expect(stepY(100, 10, -2)).toBe(150);
    expect(stepY(100, 10, 1)).toBe(135);
  });
});

describe('metrics', () => {
  it('reserves room for the whole G3–C6 range plus labels', () => {
    // G3 fruit bottom: 2.5 spaces below bottom line + half a fruit
    expect(METRICS.below).toBeGreaterThan(2.5 + METRICS.fruitSize / 2 + METRICS.labelFontSize);
    // C6 fruit top: 2 spaces above top line + half a fruit
    expect(METRICS.above).toBeGreaterThan(2 + METRICS.fruitSize / 2);
  });
  it('keeps note labels clear of the lowest fruit, even at the biggest size-by-duration scale', () => {
    // cap height of Helvetica ≈ 0.72 × font size
    const labelCapTop = METRICS.labelBaselineBelow - 0.72 * METRICS.labelFontSize;
    const g3WholeBottom = 2.5 + (METRICS.sizeByDurationScale.w * METRICS.fruitSize) / 2;
    expect(labelCapTop).toBeGreaterThan(g3WholeBottom);
    // descenders (≈ 0.25 × font size) stay inside the system band
    expect(METRICS.below).toBeGreaterThan(METRICS.labelBaselineBelow + 0.25 * METRICS.labelFontSize);
  });
  it('computes the band height of one system', () => {
    expect(systemBandMm(10)).toBeCloseTo((METRICS.above + 4 + METRICS.below) * 10);
  });
  it('defaults to the Large staff on Letter paper', () => {
    expect(DEFAULT_RENDER_OPTIONS.staffSpaceMm).toBe(STAFF_SIZES.large);
    expect(DEFAULT_RENDER_OPTIONS.paper).toBe('letter');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/layout/metrics.test.ts`
Expected: FAIL — cannot resolve `./metrics`.

- [ ] **Step 3: Implement**

`src/core/layout/options.ts`:

```ts
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
```

`src/core/layout/types.ts`:

```ts
import type { Duration, Octave, Pitch } from '../model/types';

export interface StaffItem { kind: 'staff'; x: number; y: number; width: number; spacing: number; lineWidth: number }
export interface MonsterItem { kind: 'monster'; x: number; y: number; width: number; height: number }
/** y = the G line (second line from bottom). */
export interface ClefItem { kind: 'clef'; x: number; y: number; spacing: number }
/** x, y = center of the fruit; size = diameter of the fruit's 1×1 box in mm. */
export interface FruitItem {
  kind: 'fruit'; pitch: Pitch; octave: Octave; x: number; y: number; size: number; hollow: boolean; eventIndex: number;
}
export interface StemItem { kind: 'stem'; x: number; y1: number; y2: number; width: number; color: string }
/** x, y = stem tip. */
export interface FlagItem { kind: 'flag'; x: number; y: number; direction: 'up' | 'down'; size: number; color: string }
/** y1/y2 = stem-tip line; the beam's thickness extends from there toward the notes (down for 'up' stems). */
export interface BeamItem {
  kind: 'beam'; x1: number; y1: number; x2: number; y2: number; thickness: number; color: string; direction: 'up' | 'down';
}
export interface LedgerItem { kind: 'ledger'; x1: number; x2: number; y: number; width: number }
export interface DotItem { kind: 'dot'; x: number; y: number; r: number; color: string }
/** y = middle staff line. */
export interface RestItem { kind: 'rest'; duration: Duration; x: number; y: number; spacing: number; eventIndex: number }
export interface BarLineItem { kind: 'barLine'; x: number; y1: number; y2: number; final: boolean; width: number }
export interface LabelItem {
  kind: 'label'; text: string; x: number; y: number; fontSize: number; color: string;
  anchor: 'start' | 'middle' | 'end'; weight: 'normal' | 'bold';
}
export interface LegendItem { kind: 'legend'; x: number; y: number; width: number; height: number; labels: 'letter' | 'solfege' }

export type LayoutItem =
  | StaffItem | MonsterItem | ClefItem | FruitItem | StemItem | FlagItem | BeamItem
  | LedgerItem | DotItem | RestItem | BarLineItem | LabelItem | LegendItem;

/** Where event `eventIndex` starts horizontally — used for the editor cursor. */
export interface SlotPosition { eventIndex: number; x: number }

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

export interface LayoutResult { pages: PageLayout[] }
```

`src/core/layout/metrics.ts`:

```ts
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
```

`src/core/layout/builders.ts`:

```ts
import type { LabelItem } from './types';

export function labelItem(
  text: string, x: number, y: number, fontSize: number, color: string,
  anchor: LabelItem['anchor'], weight: LabelItem['weight'],
): LabelItem {
  return { kind: 'label', text, x, y, fontSize, color, anchor, weight };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/layout/metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/layout && git commit -m "feat(layout): render options, layout item contract and metrics"
```

---

### Task 8: Spacing & system breaking

**Files:**
- Create: `src/core/layout/spacing.ts`
- Test: `src/core/layout/spacing.test.ts`

**Interfaces:**
- Consumes: `MusicEvent` (Task 2), `Measure` (Task 4), `METRICS` (Task 7)
- Produces:
  - `eventAdvance(e: MusicEvent): number` (staff spaces)
  - `measureWidth(m: Measure): number` (staff spaces)
  - `breakIntoSystems(widths: number[], available: number): number[][]` (arrays of measure indices)

- [ ] **Step 1: Write the failing test**

`src/core/layout/spacing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import { splitIntoMeasures } from '../theory/rhythm';
import { breakIntoSystems, eventAdvance, measureWidth } from './spacing';

describe('eventAdvance', () => {
  it('grows with duration and dots', () => {
    expect(eventAdvance(note('C', 4, 'e'))).toBeCloseTo(1.9);
    expect(eventAdvance(note('C', 4, 'q'))).toBeCloseTo(2.4);
    expect(eventAdvance(note('C', 4, 'q', true))).toBeCloseTo(2.9);
    expect(eventAdvance(rest('w'))).toBeCloseTo(4.4);
  });
});

describe('measureWidth', () => {
  it('adds bar padding and end padding to the advances', () => {
    const result = splitIntoMeasures([note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h')], '4/4');
    if (!result.ok) throw new Error('fixture invalid');
    expect(measureWidth(result.value[0])).toBeCloseTo(1.0 + 2.4 + 2.4 + 3.2 + 0.4);
  });
});

describe('breakIntoSystems', () => {
  it('packs measures greedily', () => {
    expect(breakIntoSystems([10, 10, 10, 10, 10], 25)).toEqual([[0, 1], [2, 3], [4]]);
  });
  it('gives an over-wide measure its own system', () => {
    expect(breakIntoSystems([5, 40, 5], 25)).toEqual([[0], [1], [2]]);
  });
  it('returns nothing for no measures', () => {
    expect(breakIntoSystems([], 25)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/layout/spacing.test.ts`
Expected: FAIL — cannot resolve `./spacing`.

- [ ] **Step 3: Implement `src/core/layout/spacing.ts`**

```ts
import type { MusicEvent } from '../model/types';
import type { Measure } from '../theory/rhythm';
import { METRICS } from './metrics';

export function eventAdvance(e: MusicEvent): number {
  return METRICS.advance[e.duration] + (e.dotted ? METRICS.dottedExtra : 0);
}

export function measureWidth(m: Measure): number {
  const content = m.events.reduce((sum, placed) => sum + eventAdvance(placed.event), 0);
  return METRICS.barPadding + content + METRICS.measureEndPadding;
}

export function breakIntoSystems(widths: number[], available: number): number[][] {
  const systems: number[][] = [];
  let current: number[] = [];
  let used = 0;
  widths.forEach((width, index) => {
    if (current.length > 0 && used + width > available) {
      systems.push(current);
      current = [];
      used = 0;
    }
    current.push(index);
    used += width;
  });
  if (current.length > 0) systems.push(current);
  return systems;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/layout/spacing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/layout && git commit -m "feat(layout): horizontal spacing and system breaking"
```

---

### Task 9: Beam groups

**Files:**
- Create: `src/core/layout/beams.ts`
- Test: `src/core/layout/beams.test.ts`

**Interfaces:**
- Consumes: `Measure` (Task 4), `staffStep` (Task 3), `UNITS_PER_QUARTER` (Task 4)
- Produces: `findBeamGroups(measure: Measure): number[][]` — pairs of **song-level** event indices to beam together. Rule: two consecutive undotted eighth **notes** starting exactly on a beat (startUnit % 4 === 0) and the next eighth, whose staff steps differ by ≤ 7 (otherwise flags are used so beams never collide with the system above/below).

- [ ] **Step 1: Write the failing test**

`src/core/layout/beams.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import type { MusicEvent } from '../model/types';
import { splitIntoMeasures } from '../theory/rhythm';
import { findBeamGroups } from './beams';

function firstMeasure(events: MusicEvent[]) {
  const result = splitIntoMeasures(events, '4/4');
  if (!result.ok) throw new Error(result.error.message);
  return result.value[0];
}

describe('findBeamGroups', () => {
  it('pairs eighths within each beat', () => {
    const m = firstMeasure([
      note('C', 4, 'e'), note('D', 4, 'e'), note('E', 4, 'e'), note('F', 4, 'e'), note('G', 4, 'h'),
    ]);
    expect(findBeamGroups(m)).toEqual([[0, 1], [2, 3]]);
  });

  it('does not beam across a beat boundary', () => {
    const m = firstMeasure([
      note('C', 4, 'q', true), note('D', 4, 'e'), note('E', 4, 'e'), note('F', 4, 'e'), note('G', 4, 'q'),
    ]);
    // D4 starts at unit 6 (off-beat), E4 at 8 (on-beat) with F4 at 10 → only [2,3]
    expect(findBeamGroups(m)).toEqual([[2, 3]]);
  });

  it('never beams rests or dotted eighths', () => {
    const m = firstMeasure([rest('e'), note('D', 4, 'e'), note('E', 4, 'e', true), note('F', 4, 'e', true)]);
    expect(findBeamGroups(m)).toEqual([]);
  });

  it('uses flags when notes are more than an octave apart', () => {
    const m = firstMeasure([note('G', 3, 'e'), note('C', 5, 'e')]);
    // G3 step -5, C5 step 5 → span 10
    expect(findBeamGroups(m)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/layout/beams.test.ts`
Expected: FAIL — cannot resolve `./beams`.

- [ ] **Step 3: Implement `src/core/layout/beams.ts`**

```ts
import type { MusicEvent, Note } from '../model/types';
import { staffStep } from '../theory/pitch';
import { UNITS_PER_QUARTER, type Measure } from '../theory/rhythm';

const MAX_BEAM_SPAN_STEPS = 7;

function isPlainEighthNote(e: MusicEvent): e is Note {
  return e.kind === 'note' && e.duration === 'e' && !e.dotted;
}

export function findBeamGroups(measure: Measure): number[][] {
  const groups: number[][] = [];
  const events = measure.events;
  for (let i = 0; i + 1 < events.length; i++) {
    const a = events[i];
    const b = events[i + 1];
    if (!isPlainEighthNote(a.event) || !isPlainEighthNote(b.event)) continue;
    if (a.startUnit % UNITS_PER_QUARTER !== 0) continue;
    const span = Math.abs(
      staffStep(a.event.pitch, a.event.octave) - staffStep(b.event.pitch, b.event.octave),
    );
    if (span > MAX_BEAM_SPAN_STEPS) continue;
    groups.push([a.index, b.index]);
    i++;
  }
  return groups;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/layout/beams.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/layout && git commit -m "feat(layout): beam grouping for eighth-note pairs"
```

---

### Task 10: System layout

**Files:**
- Create: `src/core/layout/system.ts`
- Test: `src/core/layout/system.test.ts`

**Interfaces:**
- Consumes: Tasks 2–9 (`PALETTE`, `NEUTRAL`, `TimeSignature`, `staffStep`, `stemDirection`, `ledgerSteps`, `isOnLine`, `MIDDLE_LINE_STEP`, `Measure`, `eventUnits`, `measureUnits`, `findBeamGroups`, `METRICS`, `stepY`, `RenderOptions`, `eventAdvance`, `measureWidth`, `labelItem`, layout types)
- Produces:
  - `interface SystemInput { index: number; measures: Measure[]; timeSignature: TimeSignature; staffTop: number; left: number; width: number; spacing: number; options: RenderOptions; justify: boolean; isFinalSystem: boolean }`
  - `layoutSystem(input: SystemInput): SystemLayout`

Rendering rules encoded here (from the spec): stems up below the middle line, down on/above it; a stem is `stemLength` long but always reaches at least the middle line (far ledger notes); a beamed pair takes the direction of the note farthest from the middle line (a tie → down) and every stem in it reaches the shared beam line under the same per-note rule; stems/flags/labels use the fruit's darker `stroke` shade (legible yellow); beams use that shade when both notes share a pitch, otherwise `NEUTRAL.ink`; half/whole notes are hollow; whole notes have no stem; dots sit in a space (moved up half a space when the note is on a line); a rest dot sits further right after the wide half/whole rest blocks; a measure holding nothing but one full-measure rest shows a **whole rest** centered in the measure, without a dot, in any time signature.

- [ ] **Step 1: Write the failing test**

`src/core/layout/system.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import type { MusicEvent, TimeSignature } from '../model/types';
import { PALETTE } from '../palette/palette';
import { MIDDLE_LINE_STEP } from '../theory/pitch';
import { splitIntoMeasures } from '../theory/rhythm';
import { METRICS, stepY } from './metrics';
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from './options';
import { layoutSystem } from './system';
import type { LayoutItem } from './types';

const S = 10;
const TOP = 50;

function build(
  events: MusicEvent[], options: Partial<RenderOptions> = {}, justify = false, timeSignature: TimeSignature = '4/4',
) {
  const result = splitIntoMeasures(events, timeSignature);
  if (!result.ok) throw new Error(result.error.message);
  return layoutSystem({
    index: 0, measures: result.value, timeSignature, staffTop: TOP, left: 10, width: 300, spacing: S,
    options: { ...DEFAULT_RENDER_OPTIONS, ...options }, justify, isFinalSystem: true,
  });
}

const ofKind = <K extends LayoutItem['kind']>(items: LayoutItem[], kind: K) =>
  items.filter((i): i is Extract<LayoutItem, { kind: K }> => i.kind === kind);

const MIDDLE_Y = stepY(TOP, S, MIDDLE_LINE_STEP);

describe('layoutSystem', () => {
  it('draws the staff and the monster even with no measures', () => {
    const sys = build([]);
    expect(ofKind(sys.items, 'staff')).toHaveLength(1);
    expect(ofKind(sys.items, 'monster')).toHaveLength(1);
    expect(ofKind(sys.items, 'barLine')).toHaveLength(0);
    expect(sys.endX).toBe(sys.startX);
  });

  it('centres the monster on the middle line', () => {
    const [monster] = ofKind(build([]).items, 'monster');
    expect(monster.y + monster.height / 2).toBeCloseTo(TOP + 2 * S);
  });

  it('places E4 on the bottom line and C4 on a ledger line', () => {
    const sys = build([note('E', 4, 'q'), note('C', 4, 'q')]);
    const [e4, c4] = ofKind(sys.items, 'fruit');
    expect(e4.y).toBeCloseTo(TOP + 4 * S);
    expect(c4.y).toBeCloseTo(TOP + 5 * S);
    const ledgers = ofKind(sys.items, 'ledger');
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0].y).toBeCloseTo(TOP + 5 * S);
  });

  it('makes half and whole notes hollow and gives whole notes no stem', () => {
    const sys = build([note('C', 5, 'h'), note('D', 5, 'q'), note('E', 5, 'q'), note('F', 5, 'w')]);
    expect(ofKind(sys.items, 'fruit').map((f) => f.hollow)).toEqual([true, false, false, true]);
    expect(ofKind(sys.items, 'stem')).toHaveLength(3);
  });

  it('points stems down from the middle line and up below it', () => {
    const sys = build([note('B', 4, 'q'), note('A', 4, 'q')]);
    const [b4, a4] = ofKind(sys.items, 'stem');
    expect(b4.y2).toBeGreaterThan(b4.y1);
    expect(a4.y2).toBeLessThan(a4.y1);
    expect(a4.y1 - a4.y2).toBeCloseTo(METRICS.stemLength * S);
  });

  it('stretches stems of far ledger notes to reach the middle line', () => {
    const [g3, c6] = ofKind(build([note('G', 3, 'q'), note('C', 6, 'q')]).items, 'stem');
    expect(g3.y2).toBeLessThan(g3.y1);
    expect(g3.y2).toBeLessThanOrEqual(MIDDLE_Y + 1e-9);
    expect(c6.y2).toBeGreaterThan(c6.y1);
    expect(c6.y2).toBeGreaterThanOrEqual(MIDDLE_Y - 1e-9);
  });

  it('extends every beamed stem to the middle line when a note is far below it', () => {
    const sys = build([note('G', 3, 'e'), note('B', 3, 'e')]);
    const [beam] = ofKind(sys.items, 'beam');
    expect(beam.direction).toBe('up');
    expect(beam.y1).toBeLessThanOrEqual(MIDDLE_Y + 1e-9);
    for (const stem of ofKind(sys.items, 'stem')) expect(stem.y2).toBeCloseTo(beam.y1);
  });

  it('points a beam the way of the note farthest from the middle line (a tie points down)', () => {
    // F4 is 3 steps below the middle line, D5 only 2 above → up
    const up = build([note('F', 4, 'e'), note('D', 5, 'e')]);
    expect(ofKind(up.items, 'beam')[0].direction).toBe('up');
    for (const stem of ofKind(up.items, 'stem')) expect(stem.y2).toBeLessThan(stem.y1);
    // G4 and D5 are both 2 steps away → down
    const tie = build([note('G', 4, 'e'), note('D', 5, 'e')]);
    expect(ofKind(tie.items, 'beam')[0].direction).toBe('down');
    for (const stem of ofKind(tie.items, 'stem')) expect(stem.y2).toBeGreaterThan(stem.y1);
  });

  it('beams an eighth pair with a shared stem tip and no flags', () => {
    const sys = build([note('C', 4, 'e'), note('E', 4, 'e')]);
    expect(ofKind(sys.items, 'beam')).toHaveLength(1);
    expect(ofKind(sys.items, 'flag')).toHaveLength(0);
    const [s1, s2] = ofKind(sys.items, 'stem');
    expect(s1.y2).toBeCloseTo(s2.y2);
    const [beam] = ofKind(sys.items, 'beam');
    expect(beam.color).not.toBe(PALETTE.C.stroke);
    expect(beam.direction).toBe('up');
    expect(beam.y1).toBeCloseTo(s1.y2);
  });

  it('flags a lone eighth note', () => {
    const sys = build([note('G', 4, 'e'), rest('e')]);
    expect(ofKind(sys.items, 'flag')).toHaveLength(1);
    expect(ofKind(sys.items, 'rest')).toHaveLength(1);
  });

  it('moves the dot into the space above a note on a line', () => {
    const sys = build([note('E', 4, 'h', true)]);
    const [dot] = ofKind(sys.items, 'dot');
    expect(dot.y).toBeCloseTo(TOP + 4 * S - S / 2);
  });

  it('puts the dot of a dotted rest clear of the rest glyph', () => {
    const half = build([rest('h', true), rest('q')]);
    expect(ofKind(half.items, 'dot')[0].x).toBeCloseTo(ofKind(half.items, 'rest')[0].x + 1.05 * S);
    const quarter = build([rest('q', true), rest('e')]);
    expect(ofKind(quarter.items, 'dot')[0].x).toBeCloseTo(ofKind(quarter.items, 'rest')[0].x + 0.8 * S);
  });

  it('shows a lone full-measure rest as a centered whole rest without a dot, even in 3/4', () => {
    const sys = build([rest('h', true), note('C', 4, 'q'), rest('h')], {}, false, '3/4');
    const rests = ofKind(sys.items, 'rest');
    const bars = ofKind(sys.items, 'barLine');
    expect(rests[0]).toMatchObject({ duration: 'w', eventIndex: 0 });
    expect(rests[0].x).toBeCloseTo((sys.startX + bars[0].x) / 2);
    expect(ofKind(sys.items, 'dot')).toHaveLength(0);
    // a rest that shares its measure keeps its own glyph and position
    expect(rests[1]).toMatchObject({ duration: 'h', eventIndex: 2 });
    expect(rests[1].x).toBeCloseTo(sys.slots[2].x + METRICS.noteLead * S);
  });

  it('centres a whole rest that fills a 4/4 measure', () => {
    const sys = build([rest('w')]);
    const [r] = ofKind(sys.items, 'rest');
    const [bar] = ofKind(sys.items, 'barLine');
    expect(r.duration).toBe('w');
    expect(r.x).toBeCloseTo((sys.startX + bar.x) / 2);
  });

  it('labels notes by letter, solfège, or not at all', () => {
    expect(ofKind(build([note('G', 4, 'q')]).items, 'label').map((l) => l.text)).toEqual(['G']);
    expect(
      ofKind(build([note('G', 4, 'q')], { noteLabels: 'solfege' }).items, 'label').map((l) => l.text),
    ).toEqual(['Sol']);
    expect(ofKind(build([note('G', 4, 'q')], { noteLabels: 'none' }).items, 'label')).toHaveLength(0);
  });

  it('scales fruit by duration when sizeByDuration is on', () => {
    const sys = build([note('C', 5, 'h'), note('C', 5, 'q')], { sizeByDuration: true });
    const [half, quarter] = ofKind(sys.items, 'fruit');
    expect(half.size / quarter.size).toBeCloseTo(1.15);
  });

  it('records one slot per event in order', () => {
    const sys = build([note('C', 4, 'q'), rest('q'), note('D', 4, 'h')]);
    expect(sys.slots.map((s) => s.eventIndex)).toEqual([0, 1, 2]);
    expect(sys.slots[1].x).toBeGreaterThan(sys.slots[0].x);
  });

  it('stretches a justified system to the right edge and marks the final bar', () => {
    const sys = build([note('C', 4, 'w')], {}, true);
    const bars = ofKind(sys.items, 'barLine');
    expect(bars).toHaveLength(1);
    expect(bars[0].final).toBe(true);
    expect(bars[0].x).toBeCloseTo(10 + 300 - METRICS.systemEndPadding * S);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/layout/system.test.ts`
Expected: FAIL — cannot resolve `./system`.

- [ ] **Step 3: Implement `src/core/layout/system.ts`**

```ts
import type { Note, Rest, TimeSignature } from '../model/types';
import { NEUTRAL, PALETTE } from '../palette/palette';
import { isOnLine, ledgerSteps, MIDDLE_LINE_STEP, staffStep, stemDirection } from '../theory/pitch';
import { eventUnits, measureUnits, type Measure, type PlacedEvent } from '../theory/rhythm';
import { findBeamGroups } from './beams';
import { labelItem } from './builders';
import { METRICS, stepY } from './metrics';
import type { RenderOptions } from './options';
import { eventAdvance, measureWidth } from './spacing';
import type { LayoutItem, SlotPosition, SystemLayout } from './types';

export interface SystemInput {
  index: number;
  measures: Measure[];
  timeSignature: TimeSignature;
  staffTop: number;
  left: number;
  width: number;
  spacing: number;
  options: RenderOptions;
  justify: boolean;
  isFinalSystem: boolean;
}

interface BeamInfo {
  direction: 'up' | 'down';
  tipY: number;
}

interface Placed {
  placed: PlacedEvent;
  slotX: number;
  cx: number;
}

export function layoutSystem(input: SystemInput): SystemLayout {
  const { measures, staffTop, left, width, spacing: s, options } = input;
  const items: LayoutItem[] = [];
  const slots: SlotPosition[] = [];
  const y = (step: number) => stepY(staffTop, s, step);

  items.push({ kind: 'staff', x: left, y: staffTop, width, spacing: s, lineWidth: METRICS.staffLineWidth * s });

  const monsterWidth = METRICS.monsterWidth * s;
  const monsterHeight = METRICS.monsterHeight * s;
  items.push({
    kind: 'monster', x: left, y: y(MIDDLE_LINE_STEP) - monsterHeight / 2, width: monsterWidth, height: monsterHeight,
  });

  let x = left + monsterWidth + METRICS.monsterGap * s;
  if (options.showTrebleClef) {
    items.push({ kind: 'clef', x, y: y(2), spacing: s });
    x += METRICS.clefWidth * s;
  }
  if (options.showMeasureNumbers && measures.length > 0) {
    items.push(
      labelItem(String(measures[0].number), x, staffTop - 0.8 * s, METRICS.measureNumberFontSize * s, NEUTRAL.ink, 'start', 'normal'),
    );
  }

  const startX = x;
  const natural = measures.reduce((sum, m) => sum + measureWidth(m), 0);
  const available = (left + width - x) / s - METRICS.systemEndPadding;
  const stretch = natural > 0 && (input.justify || natural > available) ? available / natural : 1;

  const capacity = measureUnits(input.timeSignature);

  measures.forEach((measure, measureIndex) => {
    const measureStartX = x;
    x += METRICS.barPadding * s * stretch;

    const placedEvents: Placed[] = measure.events.map((placed) => {
      const slotX = x;
      x += eventAdvance(placed.event) * s * stretch;
      return { placed, slotX, cx: slotX + METRICS.noteLead * s };
    });
    x += METRICS.measureEndPadding * s * stretch;
    const wholeBarRest = isWholeBarRest(measure, capacity);

    const beams = new Map<number, BeamInfo>();
    for (const group of findBeamGroups(measure)) {
      const members = placedEvents.filter((p) => group.includes(p.placed.index));
      const notes = members.map((p) => p.placed.event as Note);
      const steps = notes.map((n) => staffStep(n.pitch, n.octave));
      const direction = beamDirection(steps);
      const tipY =
        direction === 'up'
          ? Math.min(...steps.map((st) => y(st) - stemLengthFor(st, y, s)))
          : Math.max(...steps.map((st) => y(st) + stemLengthFor(st, y, s)));
      const stemXs = members.map((p, i) => stemX(p.cx, direction, fruitSize(notes[i], s, options)));
      const pitches = new Set(notes.map((n) => n.pitch));
      const color = pitches.size === 1 ? PALETTE[notes[0].pitch].stroke : NEUTRAL.ink;
      const half = (METRICS.stemWidth * s) / 2;
      items.push({
        kind: 'beam',
        x1: stemXs[0] - half, y1: tipY,
        x2: stemXs[stemXs.length - 1] + half, y2: tipY,
        thickness: METRICS.beamThickness * s,
        color,
        direction,
      });
      members.forEach((p) => beams.set(p.placed.index, { direction, tipY }));
    }

    for (const p of placedEvents) {
      slots.push({ eventIndex: p.placed.index, x: p.slotX });
      const event = p.placed.event;
      if (event.kind === 'note') {
        items.push(...noteItems(event, p.placed.index, p.cx, y, staffTop, s, options, beams.get(p.placed.index)));
      } else if (wholeBarRest) {
        items.push(wholeBarRestItem(p.placed.index, (measureStartX + x) / 2, y, s));
      } else {
        items.push(...restItems(event, p.placed.index, p.cx, y, s));
      }
    }

    items.push({
      kind: 'barLine',
      x,
      y1: staffTop,
      y2: staffTop + 4 * s,
      final: input.isFinalSystem && measureIndex === measures.length - 1,
      width: METRICS.barLineWidth * s,
    });
  });

  return {
    index: input.index,
    staffTop,
    firstMeasure: measures[0]?.number ?? 1,
    startX,
    endX: x,
    items,
    slots,
  };
}

/** The note farthest from the middle line decides; a tie (or a note on the line) points down. */
function beamDirection(steps: number[]): 'up' | 'down' {
  const distance = (st: number) => Math.abs(st - MIDDLE_LINE_STEP);
  const farthest = Math.max(...steps.map(distance));
  return steps.filter((st) => distance(st) === farthest).every((st) => st < MIDDLE_LINE_STEP) ? 'up' : 'down';
}

/** Normal stem length, but always long enough to reach the middle line (far ledger notes). */
function stemLengthFor(step: number, y: (step: number) => number, s: number): number {
  return Math.max(METRICS.stemLength * s, Math.abs(y(step) - y(MIDDLE_LINE_STEP)));
}

/** A measure holding nothing but one rest that lasts the whole measure. */
function isWholeBarRest(measure: Measure, capacity: number): boolean {
  if (measure.events.length !== 1) return false;
  const only = measure.events[0].event;
  return only.kind === 'rest' && eventUnits(only) === capacity;
}

function fruitSize(note: Note, s: number, options: RenderOptions): number {
  const scale = options.sizeByDuration ? METRICS.sizeByDurationScale[note.duration] : 1;
  return METRICS.fruitSize * s * scale;
}

function stemX(cx: number, direction: 'up' | 'down', size: number): number {
  return direction === 'up' ? cx + size * 0.42 : cx - size * 0.42;
}

function noteItems(
  note: Note,
  eventIndex: number,
  cx: number,
  y: (step: number) => number,
  staffTop: number,
  s: number,
  options: RenderOptions,
  beam: BeamInfo | undefined,
): LayoutItem[] {
  const out: LayoutItem[] = [];
  const step = staffStep(note.pitch, note.octave);
  const ny = y(step);
  const size = fruitSize(note, s, options);
  const entry = PALETTE[note.pitch];

  const ledgerHalf = (METRICS.fruitSize * s) / 2 + METRICS.ledgerExtension * s;
  for (const ledger of ledgerSteps(step)) {
    out.push({ kind: 'ledger', x1: cx - ledgerHalf, x2: cx + ledgerHalf, y: y(ledger), width: METRICS.ledgerWidth * s });
  }

  if (note.duration !== 'w') {
    const direction = beam?.direction ?? stemDirection(step);
    const sx = stemX(cx, direction, size);
    const length = stemLengthFor(step, y, s);
    const tip = beam?.tipY ?? (direction === 'up' ? ny - length : ny + length);
    out.push({ kind: 'stem', x: sx, y1: ny, y2: tip, width: METRICS.stemWidth * s, color: entry.stroke });
    if (note.duration === 'e' && !beam) {
      out.push({ kind: 'flag', x: sx, y: tip, direction, size: METRICS.flagSize * s, color: entry.stroke });
    }
  }

  out.push({
    kind: 'fruit',
    pitch: note.pitch,
    octave: note.octave,
    x: cx,
    y: ny,
    size,
    hollow: note.duration === 'h' || note.duration === 'w',
    eventIndex,
  });

  if (note.dotted) {
    out.push({
      kind: 'dot',
      x: cx + size / 2 + METRICS.dotGap * s,
      y: isOnLine(step) ? ny - s / 2 : ny,
      r: METRICS.dotRadius * s,
      color: entry.stroke,
    });
  }

  if (options.noteLabels !== 'none') {
    out.push(
      labelItem(
        options.noteLabels === 'letter' ? note.pitch : entry.solfege,
        cx,
        staffTop + 4 * s + METRICS.labelBaselineBelow * s,
        METRICS.labelFontSize * s,
        entry.stroke,
        'middle',
        'bold',
      ),
    );
  }
  return out;
}

function restItems(
  rest: Rest,
  eventIndex: number,
  cx: number,
  y: (step: number) => number,
  s: number,
): LayoutItem[] {
  const out: LayoutItem[] = [
    { kind: 'rest', duration: rest.duration, x: cx, y: y(MIDDLE_LINE_STEP), spacing: s, eventIndex },
  ];
  if (rest.dotted) {
    // half/whole rests are wide blocks; keep the dot clear of them
    const offset = rest.duration === 'h' || rest.duration === 'w' ? 1.05 : 0.8;
    out.push({ kind: 'dot', x: cx + offset * s, y: y(MIDDLE_LINE_STEP + 1), r: METRICS.dotRadius * s, color: NEUTRAL.ink });
  }
  return out;
}

/** Whole-measure rest: the whole-rest glyph centered in the measure, never dotted. */
function wholeBarRestItem(eventIndex: number, centerX: number, y: (step: number) => number, s: number): LayoutItem {
  return { kind: 'rest', duration: 'w', x: centerX, y: y(MIDDLE_LINE_STEP), spacing: s, eventIndex };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/layout/system.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/layout && git commit -m "feat(layout): lay out one staff system with fruit, stems, beams, ledgers"
```

---

### Task 11: Page layout (`layoutSong`)

**Files:**
- Create: `src/core/layout/page.ts`, `src/core/layout/index.ts`
- Test: `src/core/layout/page.test.ts`

**Interfaces:**
- Consumes: everything in `src/core/layout/*`, `splitIntoMeasures`
- Produces:
  - `class InvalidSongLayoutError extends Error`
  - `layoutSong(song: Song, options?: RenderOptions): LayoutResult` — throws `InvalidSongLayoutError` if the song has a bar-crossing note (callers pass validated songs).
  - `src/core/layout/index.ts` re-exports `layoutSong`, `InvalidSongLayoutError`, all of `options.ts` and `types.ts` — **other layers import layout only via `core/layout` (index)**.

Page rules: title on every page (`"<title> (page N)"` for N ≥ 2); legend strip at the bottom when enabled (shows solfège only if `noteLabels === 'solfege'`, otherwise letters); systems per page = as many bands as fit; the final system is left at natural width when it is less than 75 % full.

- [ ] **Step 1: Write the failing test**

`src/core/layout/page.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../model/factories';
import type { MusicEvent, Song } from '../model/types';
import { DEFAULT_RENDER_OPTIONS, layoutSong, InvalidSongLayoutError, STAFF_SIZES } from './index';

function song(events: MusicEvent[]): Song {
  return { ...createEmptySong('Test Song'), id: 'fixed', events };
}

const wholeNotes = (count: number) => Array.from({ length: count }, () => note('C', 5, 'w'));

const hotCrossBuns = [
  note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h'),
  note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h'),
  ...(['C', 'C', 'C', 'C', 'D', 'D', 'D', 'D'] as const).map((p) => note(p, 4, 'e')),
  note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h'),
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
    const result = layoutSong(song(wholeNotes(16)), { ...DEFAULT_RENDER_OPTIONS, staffSpaceMm: STAFF_SIZES.jumbo });
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
    expect(() => layoutSong(song([note('C', 4, 'h', true), note('D', 4, 'h')]))).toThrow(InvalidSongLayoutError);
  });

  it('is deterministic', () => {
    expect(layoutSong(song(hotCrossBuns))).toEqual(layoutSong(song(hotCrossBuns)));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/layout/page.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement**

`src/core/layout/page.ts`:

```ts
import type { Song } from '../model/types';
import { NEUTRAL } from '../palette/palette';
import { splitIntoMeasures } from '../theory/rhythm';
import { labelItem } from './builders';
import {
  LAST_SYSTEM_JUSTIFY_THRESHOLD, LEGEND_HEIGHT_MM, METRICS, systemBandMm, TITLE_FONT_MM, TITLE_HEIGHT_MM,
} from './metrics';
import { DEFAULT_RENDER_OPTIONS, PAGE_MARGIN_MM, PAPER_SIZES_MM, type RenderOptions } from './options';
import { breakIntoSystems, measureWidth } from './spacing';
import { layoutSystem } from './system';
import type { LayoutItem, LayoutResult, PageLayout } from './types';

export class InvalidSongLayoutError extends Error {
  override name = 'InvalidSongLayoutError';
}

export function layoutSong(song: Song, options: RenderOptions = DEFAULT_RENDER_OPTIONS): LayoutResult {
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
      labelItem(title, paper.width / 2, PAGE_MARGIN_MM + TITLE_FONT_MM, TITLE_FONT_MM, NEUTRAL.ink, 'middle', 'bold'),
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
```

`src/core/layout/index.ts`:

```ts
export { layoutSong, InvalidSongLayoutError } from './page';
export * from './options';
export type * from './types';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/layout`
Expected: PASS (all layout tests).

- [ ] **Step 5: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test`

```bash
git add src/core/layout && git commit -m "feat(layout): paginate systems into printable pages"
```
