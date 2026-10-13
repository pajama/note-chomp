import type { Duration, TimeSignature } from '../../core/model/types';
import { eventUnits, measureUnits } from '../../core/theory/rhythm';

export function durationTooLong(duration: Duration, ts: TimeSignature): boolean {
  return eventUnits({ duration }) > measureUnits(ts);
}

export function dotUnavailable(duration: Duration, ts: TimeSignature): string | null {
  if (duration === 'e') return "Dotted eighths aren't available yet";
  if (eventUnits({ duration, dotted: true }) > measureUnits(ts)) return `Too long for ${ts}`;
  return null;
}
