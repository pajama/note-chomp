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
