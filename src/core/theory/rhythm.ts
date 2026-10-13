import type { Duration, MusicEvent, TimeSignature } from '../model/types';
import { err, ok, type Result } from '../result';

export const UNITS_PER_QUARTER = 4;

const BASE_UNITS: Record<Duration, number> = { w: 16, h: 8, q: 4, e: 2 };
const DURATION_WORDS: Record<Duration, string> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  e: 'eighth',
};

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

export function unitsToDuration(
  units: number,
): { duration: Duration; dotted: boolean } | undefined {
  const found = UNITS_TO_DURATION.get(units);
  return found ? { ...found } : undefined;
}

export function durationName(e: {
  kind: 'note' | 'rest';
  duration: Duration;
  dotted?: boolean;
}): string {
  return `${e.dotted ? 'dotted ' : ''}${DURATION_WORDS[e.duration]} ${e.kind}`;
}

export function durationNameWithArticle(e: {
  kind: 'note' | 'rest';
  duration: Duration;
  dotted?: boolean;
}): string {
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
