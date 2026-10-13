# Phase 1a — Core helpers: pitch & schedule (Tasks 1–2)

Both tasks are pure TypeScript in `src/core` (no React, no DOM). Read `00-index.md` → Global Constraints first.

### Task 1: Pitch stepping & note names

**Files:**
- Modify: `src/core/theory/pitch.ts` (import line; append four functions)
- Test: `src/core/theory/pitchStep.test.ts` (new)

**Interfaces:**
- Consumes: existing `diatonicIndex(pitch, octave)` (index = octave × 7 + position in `PITCHES`), private `LOWEST`/`HIGHEST` (G3/C6) in the same file; `Pitch`, `Octave`, `PITCHES` from `src/core/model/types.ts`.
- Produces (used by Tasks 2, 6, 15, 16):
  - `fromDiatonicIndex(index: number): { pitch: Pitch; octave: Octave } | undefined` — undefined outside G3–C6 or for non-integers.
  - `stepPitch(pitch: Pitch, octave: number, delta: number): { pitch: Pitch; octave: Octave } | undefined` — `delta` diatonic steps (±1 = next line/space); undefined when the result leaves G3–C6.
  - `clampedStepPitch(pitch: Pitch, octave: number, delta: number): { pitch: Pitch; octave: Octave }` — same, but stops at G3/C6.
  - `toNoteName(pitch: Pitch, octave: number): string` — `'C4'`.

- [ ] **Step 1: Write the failing test**

**Create `src/core/theory/pitchStep.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { clampedStepPitch, fromDiatonicIndex, stepPitch, toNoteName } from './pitch';

describe('stepPitch', () => {
  it.each([
    ['E', 4, 2, { pitch: 'G', octave: 4 }],
    ['B', 4, 1, { pitch: 'C', octave: 5 }],
    ['C', 5, -1, { pitch: 'B', octave: 4 }],
    ['A', 5, 2, { pitch: 'C', octave: 6 }],
    ['A', 3, -1, { pitch: 'G', octave: 3 }],
    ['F', 4, 0, { pitch: 'F', octave: 4 }],
  ] as const)('%s%i moved %i steps', (pitch, octave, delta, expected) => {
    expect(stepPitch(pitch, octave, delta)).toEqual(expected);
  });

  it('gives up outside G3–C6', () => {
    expect(stepPitch('G', 3, -1)).toBeUndefined();
    expect(stepPitch('C', 6, 1)).toBeUndefined();
  });
});

describe('clampedStepPitch', () => {
  it('stops at the top and bottom of the range', () => {
    expect(clampedStepPitch('A', 5, 5)).toEqual({ pitch: 'C', octave: 6 });
    expect(clampedStepPitch('A', 3, -4)).toEqual({ pitch: 'G', octave: 3 });
    expect(clampedStepPitch('E', 4, -3)).toEqual({ pitch: 'B', octave: 3 });
  });
});

describe('fromDiatonicIndex', () => {
  it('is the inverse of diatonicIndex inside the range', () => {
    expect(fromDiatonicIndex(4 * 7 + 2)).toEqual({ pitch: 'E', octave: 4 });
    expect(fromDiatonicIndex(3 * 7 + 3)).toBeUndefined(); // F3
    expect(fromDiatonicIndex(2.5)).toBeUndefined();
  });
});

describe('toNoteName', () => {
  it('writes scientific pitch names', () => {
    expect(toNoteName('C', 4)).toBe('C4');
    expect(toNoteName('G', 3)).toBe('G3');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/theory/pitchStep.test.ts`
Expected: FAIL — `SyntaxError`/`does not provide an export named 'clampedStepPitch'` (the functions don't exist yet).

- [ ] **Step 3: Implement**

**Edit `src/core/theory/pitch.ts`** — replace:

```ts
import { PITCHES, type Pitch } from '../model/types';
```

with:

```ts
import { PITCHES, type Octave, type Pitch } from '../model/types';
```

**Append to `src/core/theory/pitch.ts`:**

```ts
/** The pitch at a diatonic index, or undefined when it is outside G3–C6. */
export function fromDiatonicIndex(index: number): { pitch: Pitch; octave: Octave } | undefined {
  if (!Number.isInteger(index) || index < LOWEST || index > HIGHEST) return undefined;
  return { pitch: PITCHES[index % 7], octave: Math.floor(index / 7) as Octave };
}

/** Move `delta` lines/spaces (diatonic steps); undefined when the result leaves G3–C6. */
export function stepPitch(
  pitch: Pitch,
  octave: number,
  delta: number,
): { pitch: Pitch; octave: Octave } | undefined {
  return fromDiatonicIndex(diatonicIndex(pitch, octave) + delta);
}

/** Like stepPitch, but stops at G3 / C6 instead of giving up. */
export function clampedStepPitch(
  pitch: Pitch,
  octave: number,
  delta: number,
): { pitch: Pitch; octave: Octave } {
  const index = Math.min(HIGHEST, Math.max(LOWEST, diatonicIndex(pitch, octave) + delta));
  return fromDiatonicIndex(index) as { pitch: Pitch; octave: Octave };
}

/** Scientific pitch name, e.g. toNoteName('C', 4) === 'C4'. */
export function toNoteName(pitch: Pitch, octave: number): string {
  return `${pitch}${octave}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/theory`
Expected: PASS (all `pitch.test.ts` and `pitchStep.test.ts` tests).

- [ ] **Step 5: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/core/theory/pitch.ts src/core/theory/pitchStep.test.ts
git commit -m "feat(core): diatonic pitch stepping and note names"
```

Expected: lint/typecheck clean, all unit tests pass.

---

### Task 2: Playback schedule

**Files:**
- Create: `src/core/playback/schedule.ts`
- Test: `src/core/playback/schedule.test.ts`

**Interfaces:**
- Consumes: `toNoteName` (Task 1); `eventUnits`, `UNITS_PER_QUARTER` (= 4 units per quarter) from `src/core/theory/rhythm.ts`; `Song`.
- Produces (used by Tasks 8, 9, 11):
  - `BPM_RANGE = { min: 60, max: 160, default: 90 } as const`
  - `interface ScheduledEvent { eventIndex: number; time: number; duration: number; note: string | null }` — seconds; `note` is `'C4'` or `null` for a rest.
  - `clampBpm(bpm: number): number`
  - `buildSchedule(song: Song, bpm: number, fromIndex = 0): ScheduledEvent[]` — from `fromIndex` (clamped) to the end, first event at time 0, quarter = 60/bpm s, bpm clamped to `BPM_RANGE`.
  - `scheduleEnd(schedule: readonly ScheduledEvent[]): number` — end time of the last event (0 if empty).

- [ ] **Step 1: Write the failing test**

**Create `src/core/playback/schedule.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from '../model/factories';
import { BPM_RANGE, buildSchedule, clampBpm, scheduleEnd } from './schedule';

const song = {
  ...createEmptySong('Tune'),
  events: [note('C', 4, 'q'), note('D', 4, 'h'), rest('e'), note('E', 5, 'q', true)],
};

describe('buildSchedule', () => {
  it('times every event at 60 bpm (one quarter = one second)', () => {
    expect(buildSchedule(song, 60)).toEqual([
      { eventIndex: 0, time: 0, duration: 1, note: 'C4' },
      { eventIndex: 1, time: 1, duration: 2, note: 'D4' },
      { eventIndex: 2, time: 3, duration: 0.5, note: null },
      { eventIndex: 3, time: 3.5, duration: 1.5, note: 'E5' },
    ]);
  });

  it('goes twice as fast at 120 bpm', () => {
    const times = buildSchedule(song, 120).map((e) => [e.time, e.duration]);
    expect(times).toEqual([
      [0, 0.5],
      [0.5, 1],
      [1.5, 0.25],
      [1.75, 0.75],
    ]);
  });

  it('starts from a chosen event at time 0', () => {
    const fromRest = buildSchedule(song, 60, 2);
    expect(fromRest.map((e) => e.eventIndex)).toEqual([2, 3]);
    expect(fromRest[0].time).toBe(0);
    expect(fromRest[1].time).toBe(0.5);
  });

  it('clamps the start index and the tempo', () => {
    expect(buildSchedule(song, 60, 99)).toEqual([]);
    expect(buildSchedule(song, 60, -3)).toHaveLength(4);
    expect(buildSchedule(song, 10)[0].duration).toBe(1);
    expect(buildSchedule(song, 999)[0].duration).toBe(60 / BPM_RANGE.max);
  });
});

describe('scheduleEnd / clampBpm', () => {
  it('reports when the last event ends', () => {
    expect(scheduleEnd(buildSchedule(song, 60))).toBe(5);
    expect(scheduleEnd([])).toBe(0);
  });
  it('keeps the tempo between 60 and 160', () => {
    expect(BPM_RANGE).toEqual({ min: 60, max: 160, default: 90 });
    expect(clampBpm(30)).toBe(60);
    expect(clampBpm(200)).toBe(160);
    expect(clampBpm(100)).toBe(100);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/core/playback`
Expected: FAIL — `Failed to resolve import "./schedule"`.

- [ ] **Step 3: Implement**

**Create `src/core/playback/schedule.ts`:**

```ts
import type { Song } from '../model/types';
import { toNoteName } from '../theory/pitch';
import { eventUnits, UNITS_PER_QUARTER } from '../theory/rhythm';

export const BPM_RANGE = { min: 60, max: 160, default: 90 } as const;

export interface ScheduledEvent {
  eventIndex: number;
  /** Seconds after playback starts. */
  time: number;
  /** Seconds. */
  duration: number;
  /** 'C4' for a note, null for a rest. */
  note: string | null;
}

export function clampBpm(bpm: number): number {
  return Math.min(BPM_RANGE.max, Math.max(BPM_RANGE.min, bpm));
}

/** Timing for every event from `fromIndex` to the end; the first one starts at time 0. */
export function buildSchedule(song: Song, bpm: number, fromIndex = 0): ScheduledEvent[] {
  const secondsPerUnit = 60 / clampBpm(bpm) / UNITS_PER_QUARTER;
  const start = Math.min(song.events.length, Math.max(0, fromIndex));
  const schedule: ScheduledEvent[] = [];
  let time = 0;
  for (let eventIndex = start; eventIndex < song.events.length; eventIndex++) {
    const event = song.events[eventIndex];
    const duration = eventUnits(event) * secondsPerUnit;
    schedule.push({
      eventIndex,
      time,
      duration,
      note: event.kind === 'note' ? toNoteName(event.pitch, event.octave) : null,
    });
    time += duration;
  }
  return schedule;
}

/** When the last event finishes (0 for an empty schedule). */
export function scheduleEnd(schedule: readonly ScheduledEvent[]): number {
  const last = schedule[schedule.length - 1];
  return last ? last.time + last.duration : 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/playback`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/core/playback
git commit -m "feat(core): playback schedule from a song and tempo"
```

