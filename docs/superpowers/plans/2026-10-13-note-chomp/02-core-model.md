# Phase 2 — Core model, theory, palette, validation

All files in this phase live under `src/core/` and must not import React, DOM, or any other layer.

### Task 2: Model types & factories

**Files:**
- Create: `src/core/model/types.ts`, `src/core/model/factories.ts`, `src/core/model/id.ts`
- Test: `src/core/model/factories.test.ts`

**Interfaces:**
- Produces:
  - `PITCHES`, `Pitch`, `DURATIONS`, `Duration`, `OCTAVES`, `Octave`, `TIME_SIGNATURES`, `TimeSignature`, `Note`, `Rest`, `MusicEvent`, `Song`
  - `note(pitch: Pitch, octave: Octave, duration: Duration, dotted?: boolean): Note`
  - `rest(duration: Duration, dotted?: boolean): Rest`
  - `createEmptySong(title?: string, timeSignature?: TimeSignature): Song`
  - `newSongId(): string`

- [ ] **Step 1: Write the failing test**

`src/core/model/factories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from './factories';
import { newSongId } from './id';

describe('model factories', () => {
  it('builds a note without a dotted flag by default', () => {
    expect(note('C', 4, 'q')).toEqual({ kind: 'note', pitch: 'C', octave: 4, duration: 'q' });
  });
  it('builds a dotted note', () => {
    expect(note('E', 5, 'h', true)).toEqual({
      kind: 'note', pitch: 'E', octave: 5, duration: 'h', dotted: true,
    });
  });
  it('builds rests', () => {
    expect(rest('e')).toEqual({ kind: 'rest', duration: 'e' });
    expect(rest('q', true)).toEqual({ kind: 'rest', duration: 'q', dotted: true });
  });
  it('creates an empty 4/4 song with a fresh id', () => {
    const song = createEmptySong();
    expect(song).toMatchObject({ schemaVersion: 1, title: 'My Song', timeSignature: '4/4', events: [] });
    expect(song.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('generates unique ids', () => {
    expect(newSongId()).not.toEqual(newSongId());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/model`
Expected: FAIL — cannot resolve `./factories`.

- [ ] **Step 3: Implement**

`src/core/model/types.ts`:

```ts
export const PITCHES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Pitch = (typeof PITCHES)[number];

/** w = whole, h = half, q = quarter, e = eighth */
export const DURATIONS = ['w', 'h', 'q', 'e'] as const;
export type Duration = (typeof DURATIONS)[number];

export const OCTAVES = [3, 4, 5, 6] as const;
export type Octave = (typeof OCTAVES)[number];

export const TIME_SIGNATURES = ['2/4', '3/4', '4/4'] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export interface Note {
  kind: 'note';
  pitch: Pitch;
  octave: Octave;
  duration: Duration;
  dotted?: boolean;
}

export interface Rest {
  kind: 'rest';
  duration: Duration;
  dotted?: boolean;
}

export type MusicEvent = Note | Rest;

export interface Song {
  schemaVersion: 1;
  id: string;
  title: string;
  timeSignature: TimeSignature;
  events: MusicEvent[];
}
```

`src/core/model/id.ts`:

```ts
export function newSongId(): string {
  return crypto.randomUUID();
}
```

`src/core/model/factories.ts`:

```ts
import { newSongId } from './id';
import type { Duration, Note, Octave, Pitch, Rest, Song, TimeSignature } from './types';

export function note(pitch: Pitch, octave: Octave, duration: Duration, dotted = false): Note {
  return dotted
    ? { kind: 'note', pitch, octave, duration, dotted: true }
    : { kind: 'note', pitch, octave, duration };
}

export function rest(duration: Duration, dotted = false): Rest {
  return dotted ? { kind: 'rest', duration, dotted: true } : { kind: 'rest', duration };
}

export function createEmptySong(title = 'My Song', timeSignature: TimeSignature = '4/4'): Song {
  return { schemaVersion: 1, id: newSongId(), title, timeSignature, events: [] };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/model`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/model && git commit -m "feat(core): song model types and factories"
```

---

### Task 3: Pitch theory

**Files:**
- Create: `src/core/theory/pitch.ts`
- Test: `src/core/theory/pitch.test.ts`

**Interfaces:**
- Consumes: `PITCHES`, `Pitch` (Task 2)
- Produces:
  - `diatonicIndex(pitch: Pitch, octave: number): number`
  - `isInRange(pitch: Pitch, octave: number): boolean` — G3..C6 inclusive
  - `staffStep(pitch: Pitch, octave: number): number` — 0 = bottom line E4, +1 per line/space upward
  - `MIDDLE_LINE_STEP = 4`
  - `stemDirection(step: number): 'up' | 'down'`
  - `ledgerSteps(step: number): number[]`
  - `isOnLine(step: number): boolean`
  - `RANGE_LABEL = 'G3–C6'`

- [ ] **Step 1: Write the failing test**

`src/core/theory/pitch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isInRange, isOnLine, ledgerSteps, staffStep, stemDirection } from './pitch';

describe('staffStep', () => {
  it.each([
    ['G', 3, -5], ['C', 4, -2], ['D', 4, -1], ['E', 4, 0], ['F', 4, 1],
    ['B', 4, 4], ['F', 5, 8], ['A', 5, 10], ['C', 6, 12],
  ] as const)('%s%i → %i', (pitch, octave, step) => {
    expect(staffStep(pitch, octave)).toBe(step);
  });
});

describe('isInRange', () => {
  it('accepts the bounds G3 and C6', () => {
    expect(isInRange('G', 3)).toBe(true);
    expect(isInRange('C', 6)).toBe(true);
  });
  it('rejects F3 and D6', () => {
    expect(isInRange('F', 3)).toBe(false);
    expect(isInRange('D', 6)).toBe(false);
  });
});

describe('stemDirection', () => {
  it('points up below the middle line and down from it', () => {
    expect(stemDirection(3)).toBe('up');
    expect(stemDirection(4)).toBe('down');
    expect(stemDirection(-5)).toBe('up');
  });
});

describe('ledgerSteps', () => {
  it.each([
    [0, []], [8, []], [9, []], [-1, []],
    [-2, [-2]], [-3, [-2]], [-4, [-2, -4]], [-5, [-2, -4]],
    [10, [10]], [11, [10]], [12, [10, 12]],
  ])('step %i → %j', (step, expected) => {
    expect(ledgerSteps(step)).toEqual(expected);
  });
});

describe('isOnLine', () => {
  it('even steps are on lines', () => {
    expect(isOnLine(0)).toBe(true);
    expect(isOnLine(-2)).toBe(true);
    expect(isOnLine(1)).toBe(false);
    expect(isOnLine(-5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/theory/pitch.test.ts`
Expected: FAIL — cannot resolve `./pitch`.

- [ ] **Step 3: Implement `src/core/theory/pitch.ts`**

```ts
import { PITCHES, type Pitch } from '../model/types';

export function diatonicIndex(pitch: Pitch, octave: number): number {
  return octave * 7 + PITCHES.indexOf(pitch);
}

const LOWEST = diatonicIndex('G', 3);
const HIGHEST = diatonicIndex('C', 6);
const BOTTOM_LINE = diatonicIndex('E', 4);

export const RANGE_LABEL = 'G3–C6';
export const MIDDLE_LINE_STEP = 4;

export function isInRange(pitch: Pitch, octave: number): boolean {
  const index = diatonicIndex(pitch, octave);
  return index >= LOWEST && index <= HIGHEST;
}

/** Steps above the bottom staff line (E4). Lines are even steps, spaces odd. */
export function staffStep(pitch: Pitch, octave: number): number {
  return diatonicIndex(pitch, octave) - BOTTOM_LINE;
}

export function isOnLine(step: number): boolean {
  return Math.abs(step) % 2 === 0;
}

export function stemDirection(step: number): 'up' | 'down' {
  return step < MIDDLE_LINE_STEP ? 'up' : 'down';
}

/** Ledger lines needed for a note at `step` (staff lines occupy steps 0..8). */
export function ledgerSteps(step: number): number[] {
  const steps: number[] = [];
  for (let s = -2; s >= step; s -= 2) steps.push(s);
  for (let s = 10; s <= step; s += 2) steps.push(s);
  return steps;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/theory/pitch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/theory && git commit -m "feat(core): pitch → staff position theory"
```

---

### Task 4: Rhythm & measures

**Files:**
- Create: `src/core/theory/rhythm.ts`
- Test: `src/core/theory/rhythm.test.ts`

**Interfaces:**
- Consumes: `Duration`, `MusicEvent`, `TimeSignature` (Task 2); `Result`, `ok`, `err` (Task 1)
- Produces:
  - `UNITS_PER_QUARTER = 4` (1 unit = a sixteenth)
  - `eventUnits(e: { duration: Duration; dotted?: boolean }): number`
  - `measureUnits(ts: TimeSignature): number`
  - `unitsToDuration(units: number): { duration: Duration; dotted: boolean } | undefined`
  - `durationName(e: { kind: 'note' | 'rest'; duration: Duration; dotted?: boolean }): string`
  - `durationNameWithArticle(e: { kind: 'note' | 'rest'; duration: Duration; dotted?: boolean }): string` — `"a quarter note"`, `"an eighth rest"`
  - `formatBeats(units: number): string`
  - `interface PlacedEvent { event: MusicEvent; index: number; startUnit: number }`
  - `interface Measure { number: number; events: PlacedEvent[]; filledUnits: number }`
  - `interface MeasureError { eventIndex: number; measureNumber: number; message: string }` — `eventIndex` is the event that does not fit (callers look it up to name it)
  - `splitIntoMeasures(events: MusicEvent[], ts: TimeSignature): Result<Measure[], MeasureError>`

- [ ] **Step 1: Write the failing test**

`src/core/theory/rhythm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import {
  durationName, durationNameWithArticle, eventUnits, formatBeats, measureUnits, splitIntoMeasures, unitsToDuration,
} from './rhythm';

describe('eventUnits', () => {
  it('counts sixteenths', () => {
    expect(eventUnits({ duration: 'w' })).toBe(16);
    expect(eventUnits({ duration: 'h' })).toBe(8);
    expect(eventUnits({ duration: 'q' })).toBe(4);
    expect(eventUnits({ duration: 'e' })).toBe(2);
  });
  it('adds half for a dot', () => {
    expect(eventUnits({ duration: 'h', dotted: true })).toBe(12);
    expect(eventUnits({ duration: 'e', dotted: true })).toBe(3);
  });
});

describe('measureUnits', () => {
  it('uses beats × 4', () => {
    expect(measureUnits('2/4')).toBe(8);
    expect(measureUnits('3/4')).toBe(12);
    expect(measureUnits('4/4')).toBe(16);
  });
});

describe('unitsToDuration', () => {
  it.each([
    [16, { duration: 'w', dotted: false }],
    [12, { duration: 'h', dotted: true }],
    [8, { duration: 'h', dotted: false }],
    [6, { duration: 'q', dotted: true }],
    [4, { duration: 'q', dotted: false }],
    [3, { duration: 'e', dotted: true }],
    [2, { duration: 'e', dotted: false }],
  ])('%i units', (units, expected) => {
    expect(unitsToDuration(units)).toEqual(expected);
  });
  it('rejects unsupported lengths', () => {
    expect(unitsToDuration(1)).toBeUndefined();
    expect(unitsToDuration(5)).toBeUndefined();
    expect(unitsToDuration(24)).toBeUndefined();
    expect(unitsToDuration(2.5)).toBeUndefined();
  });
});

describe('names', () => {
  it('describes durations for kids', () => {
    expect(durationName(note('C', 4, 'h', true))).toBe('dotted half note');
    expect(durationName(rest('e'))).toBe('eighth rest');
  });
  it('picks "a" or "an"', () => {
    expect(durationNameWithArticle(note('C', 4, 'q'))).toBe('a quarter note');
    expect(durationNameWithArticle(rest('e'))).toBe('an eighth rest');
    expect(durationNameWithArticle(note('C', 4, 'e', true))).toBe('a dotted eighth note');
  });
  it('formats beats', () => {
    expect(formatBeats(2)).toBe('½ beat');
    expect(formatBeats(4)).toBe('1 beat');
    expect(formatBeats(6)).toBe('1½ beats');
    expect(formatBeats(8)).toBe('2 beats');
  });
});

describe('splitIntoMeasures', () => {
  it('returns no measures for no events', () => {
    expect(splitIntoMeasures([], '4/4')).toEqual({ ok: true, value: [] });
  });

  it('splits full measures and keeps an incomplete last measure', () => {
    const events = [note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h'), note('E', 4, 'q')];
    const result = splitIntoMeasures(events, '4/4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]).toMatchObject({ number: 1, filledUnits: 16 });
    expect(result.value[0].events.map((p) => p.startUnit)).toEqual([0, 4, 8]);
    expect(result.value[1]).toMatchObject({ number: 2, filledUnits: 4 });
    expect(result.value[1].events[0]).toMatchObject({ index: 3, startUnit: 0 });
  });

  it('rejects a note that crosses the bar line', () => {
    const events = [note('C', 4, 'h', true), note('D', 4, 'h')];
    const result = splitIntoMeasures(events, '4/4');
    expect(result).toEqual({
      ok: false,
      error: {
        eventIndex: 1,
        measureNumber: 1,
        message: "Measure 1: the half note doesn't fit — only 1 beat is left in this measure.",
      },
    });
  });

  it('rejects a note longer than a whole measure', () => {
    const result = splitIntoMeasures([note('C', 4, 'w')], '3/4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe(
      "Measure 1: a whole note is longer than a whole measure of 3/4.",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/theory/rhythm.test.ts`
Expected: FAIL — cannot resolve `./rhythm`.

- [ ] **Step 3: Implement `src/core/theory/rhythm.ts`**

```ts
import type { Duration, MusicEvent, TimeSignature } from '../model/types';
import { err, ok, type Result } from '../result';

export const UNITS_PER_QUARTER = 4;

const BASE_UNITS: Record<Duration, number> = { w: 16, h: 8, q: 4, e: 2 };
const DURATION_WORDS: Record<Duration, string> = { w: 'whole', h: 'half', q: 'quarter', e: 'eighth' };

export function eventUnits(e: { duration: Duration; dotted?: boolean }): number {
  const base = BASE_UNITS[e.duration];
  return e.dotted ? base * 1.5 : base;
}

export function measureUnits(ts: TimeSignature): number {
  return Number(ts.split('/')[0]) * UNITS_PER_QUARTER;
}

const UNITS_TO_DURATION = new Map<number, { duration: Duration; dotted: boolean }>([
  [16, { duration: 'w', dotted: false }],
  [12, { duration: 'h', dotted: true }],
  [8, { duration: 'h', dotted: false }],
  [6, { duration: 'q', dotted: true }],
  [4, { duration: 'q', dotted: false }],
  [3, { duration: 'e', dotted: true }],
  [2, { duration: 'e', dotted: false }],
]);

export function unitsToDuration(units: number): { duration: Duration; dotted: boolean } | undefined {
  const found = UNITS_TO_DURATION.get(units);
  return found ? { ...found } : undefined;
}

export function durationName(e: { kind: 'note' | 'rest'; duration: Duration; dotted?: boolean }): string {
  return `${e.dotted ? 'dotted ' : ''}${DURATION_WORDS[e.duration]} ${e.kind}`;
}

export function durationNameWithArticle(e: { kind: 'note' | 'rest'; duration: Duration; dotted?: boolean }): string {
  const name = durationName(e);
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;
}

export function formatBeats(units: number): string {
  const beats = units / UNITS_PER_QUARTER;
  const whole = Math.floor(beats);
  const frac = beats - whole;
  const fracText = frac === 0.5 ? '½' : frac === 0.25 ? '¼' : frac === 0.75 ? '¾' : '';
  const text = whole === 0 ? fracText : `${whole}${fracText}`;
  return `${text} ${beats === 1 || beats < 1 ? 'beat' : 'beats'}`;
}

export interface PlacedEvent {
  event: MusicEvent;
  index: number;
  startUnit: number;
}

export interface Measure {
  number: number;
  events: PlacedEvent[];
  filledUnits: number;
}

export interface MeasureError {
  eventIndex: number;
  measureNumber: number;
  message: string;
}

export function splitIntoMeasures(
  events: MusicEvent[],
  ts: TimeSignature,
): Result<Measure[], MeasureError> {
  const capacity = measureUnits(ts);
  const measures: Measure[] = [];
  let current: Measure = { number: 1, events: [], filledUnits: 0 };

  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const units = eventUnits(event);

    if (units > capacity) {
      return err({
        eventIndex: index,
        measureNumber: current.number,
        message: `Measure ${current.number}: ${durationNameWithArticle(event)} is longer than a whole measure of ${ts}.`,
      });
    }
    const remaining = capacity - current.filledUnits;
    if (units > remaining) {
      return err({
        eventIndex: index,
        measureNumber: current.number,
        message: `Measure ${current.number}: the ${durationName(event)} doesn't fit — only ${formatBeats(remaining)} ${remaining === UNITS_PER_QUARTER || remaining < UNITS_PER_QUARTER ? 'is' : 'are'} left in this measure.`,
      });
    }

    current.events.push({ event, index, startUnit: current.filledUnits });
    current.filledUnits += units;

    if (current.filledUnits === capacity) {
      measures.push(current);
      current = { number: current.number + 1, events: [], filledUnits: 0 };
    }
  }

  if (current.events.length > 0) measures.push(current);
  return ok(measures);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/theory/rhythm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/theory && git commit -m "feat(core): rhythm units and measure splitting"
```

---

### Task 5: Palette

**Files:**
- Create: `src/core/palette/palette.ts`
- Test: `src/core/palette/palette.test.ts`

**Interfaces:**
- Consumes: `Pitch`, `PITCHES` (Task 2)
- Produces:
  - `type FruitKind = 'apple' | 'orange' | 'lemon' | 'pear' | 'blueberry' | 'grape' | 'raspberry'`
  - `interface PaletteEntry { fruit: FruitKind; fruitName: string; solfege: string; color: string; tint: string; stroke: string }`
  - `PALETTE: Readonly<Record<Pitch, PaletteEntry>>`
  - `NEUTRAL = { ink, staff, twig, leaf, leafStroke, fruitStem, paper }` (hex strings)

- [ ] **Step 1: Write the failing test**

`src/core/palette/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PITCHES } from '../model/types';
import { NEUTRAL, PALETTE } from './palette';

const HEX = /^#[0-9A-F]{6}$/;

describe('PALETTE', () => {
  it('maps the legend from the spec', () => {
    expect(PITCHES.map((p) => PALETTE[p].fruit)).toEqual([
      'apple', 'orange', 'lemon', 'pear', 'blueberry', 'grape', 'raspberry',
    ]);
    expect(PITCHES.map((p) => PALETTE[p].solfege)).toEqual(['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti']);
  });

  it('uses distinct, valid uppercase hex colors', () => {
    const colors = PITCHES.map((p) => PALETTE[p].color);
    expect(new Set(colors).size).toBe(7);
    for (const p of PITCHES) {
      expect(PALETTE[p].color).toMatch(HEX);
      expect(PALETTE[p].tint).toMatch(HEX);
      expect(PALETTE[p].stroke).toMatch(HEX);
    }
    for (const value of Object.values(NEUTRAL)) expect(value).toMatch(HEX);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/palette`
Expected: FAIL — cannot resolve `./palette`.

- [ ] **Step 3: Implement `src/core/palette/palette.ts`**

```ts
import type { Pitch } from '../model/types';

export type FruitKind = 'apple' | 'orange' | 'lemon' | 'pear' | 'blueberry' | 'grape' | 'raspberry';

export interface PaletteEntry {
  fruit: FruitKind;
  fruitName: string;
  solfege: string;
  /** Main fill (solid notes) and outline (hollow notes). */
  color: string;
  /** Pale fill for hollow (half/whole) notes. */
  tint: string;
  /** Darker shade for outlines and labels — keeps yellow legible on white paper. */
  stroke: string;
}

/**
 * Chroma-Notes / Boomwhackers rainbow, as used by Prodigies.
 * Single source of truth for note colors — change colors here only.
 */
export const PALETTE: Readonly<Record<Pitch, PaletteEntry>> = {
  C: { fruit: 'apple', fruitName: 'Apple', solfege: 'Do', color: '#E53935', tint: '#FDE3E2', stroke: '#9E1F1C' },
  D: { fruit: 'orange', fruitName: 'Orange', solfege: 'Re', color: '#FB8C00', tint: '#FFEBD1', stroke: '#A65B00' },
  E: { fruit: 'lemon', fruitName: 'Lemon', solfege: 'Mi', color: '#FDD835', tint: '#FFF8D6', stroke: '#9A7F00' },
  F: { fruit: 'pear', fruitName: 'Pear', solfege: 'Fa', color: '#7CB342', tint: '#EAF4DE', stroke: '#4B6E22' },
  G: { fruit: 'blueberry', fruitName: 'Blueberry', solfege: 'Sol', color: '#26C6DA', tint: '#DDF6FA', stroke: '#0E7C8A' },
  A: { fruit: 'grape', fruitName: 'Grapes', solfege: 'La', color: '#8E24AA', tint: '#F1DDF6', stroke: '#5A1370' },
  B: { fruit: 'raspberry', fruitName: 'Raspberry', solfege: 'Ti', color: '#EC407A', tint: '#FDE0EA', stroke: '#A3174A' },
};

export const NEUTRAL = {
  ink: '#37474F',
  staff: '#546E7A',
  twig: '#8D6E63',
  leaf: '#66BB6A',
  leafStroke: '#2E7D32',
  fruitStem: '#6D4C41',
  paper: '#FFFFFF',
} as const;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/palette`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/palette && git commit -m "feat(core): Prodigies/Chroma-Notes fruit palette"
```

---

### Task 6: Song validation

**Files:**
- Create: `src/core/model/schema.ts`
- Test: `src/core/model/schema.test.ts`

**Interfaces:**
- Consumes: model types (Task 2), `isInRange`, `RANGE_LABEL` (Task 3), `splitIntoMeasures` (Task 4), `Result` (Task 1)
- Produces:
  - `songSchema` (zod)
  - `interface ValidationIssue { path: (string | number)[]; message: string }`
  - `validateSong(input: unknown): Result<Song, ValidationIssue[]>`

- [ ] **Step 1: Write the failing test**

`src/core/model/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { note } from './factories';
import { validateSong } from './schema';

const base = { schemaVersion: 1, id: 'abc', title: 'Hot Cross Buns', timeSignature: '4/4' };

describe('validateSong', () => {
  it('accepts a valid song and trims the title', () => {
    const result = validateSong({ ...base, title: '  Hot Cross Buns ', events: [note('E', 4, 'q')] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe('Hot Cross Buns');
  });

  it('rejects non-objects and wrong schema versions', () => {
    expect(validateSong(null).ok).toBe(false);
    expect(validateSong({ ...base, schemaVersion: 2, events: [] }).ok).toBe(false);
  });

  it('rejects an empty title', () => {
    const result = validateSong({ ...base, title: '   ', events: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects notes outside G3–C6 with a numbered message', () => {
    const result = validateSong({ ...base, events: [note('C', 4, 'q'), note('F', 3, 'q')] });
    expect(result).toEqual({
      ok: false,
      error: [
        {
          path: ['events', 1],
          message: "Note 2: F3 is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
        },
      ],
    });
  });

  it('rejects unsupported time signatures', () => {
    expect(validateSong({ ...base, timeSignature: '6/8', events: [] }).ok).toBe(false);
  });

  it('rejects bar-crossing notes', () => {
    const result = validateSong({ ...base, events: [note('C', 4, 'h', true), note('D', 4, 'h')] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error[0].path).toEqual(['events', 1]);
    expect(result.error[0].message).toMatch(/^Measure 1:/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/model/schema.test.ts`
Expected: FAIL — cannot resolve `./schema`.

- [ ] **Step 3: Implement `src/core/model/schema.ts`**

```ts
import { z } from 'zod';
import { err, ok, type Result } from '../result';
import { isInRange, RANGE_LABEL } from '../theory/pitch';
import { splitIntoMeasures } from '../theory/rhythm';
import { DURATIONS, PITCHES, TIME_SIGNATURES, type Song } from './types';

const durationSchema = z.enum(DURATIONS);

const noteSchema = z.object({
  kind: z.literal('note'),
  pitch: z.enum(PITCHES),
  octave: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  duration: durationSchema,
  dotted: z.boolean().optional(),
});

const restSchema = z.object({
  kind: z.literal('rest'),
  duration: durationSchema,
  dotted: z.boolean().optional(),
});

export const songSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    title: z.string().trim().min(1, 'Give the song a title.').max(100),
    timeSignature: z.enum(TIME_SIGNATURES),
    events: z.array(z.discriminatedUnion('kind', [noteSchema, restSchema])).max(2000),
  })
  .superRefine((song, ctx) => {
    song.events.forEach((event, i) => {
      if (event.kind === 'note' && !isInRange(event.pitch, event.octave)) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', i],
          message: `Note ${i + 1}: ${event.pitch}${event.octave} is outside Note Chomp's range (the G below middle C up to high C, ${RANGE_LABEL}).`,
        });
      }
    });
    const measures = splitIntoMeasures(song.events, song.timeSignature);
    if (!measures.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['events', measures.error.eventIndex],
        message: measures.error.message,
      });
    }
  });

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

export function validateSong(input: unknown): Result<Song, ValidationIssue[]> {
  const parsed = songSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data satisfies Song);
  return err(
    parsed.error.issues.map((issue) => ({
      path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
      message: issue.message,
    })),
  );
}
```

> If `satisfies Song` reports an `exactOptionalPropertyTypes`-style mismatch on `dotted`, replace with `parsed.data as Song` — the schema mirrors the type exactly.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/model/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all clean.

```bash
git add src/core/model && git commit -m "feat(core): zod song validation with range and bar checks"
```
