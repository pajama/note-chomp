import { PITCHES, type Octave, type Pitch } from '../model/types';

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
