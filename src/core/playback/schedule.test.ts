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
