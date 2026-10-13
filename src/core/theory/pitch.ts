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
