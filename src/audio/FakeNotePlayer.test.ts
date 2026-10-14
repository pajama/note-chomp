import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptySong, note, rest } from '../core/model/factories';
import { buildSchedule } from '../core/playback/schedule';
import { FAKE_LOAD_ERROR, FakeNotePlayer } from './FakeNotePlayer';

const song = {
  ...createEmptySong('T'),
  events: [note('C', 4, 'q'), rest('q'), note('E', 4, 'h')],
};
const schedule = buildSchedule(song, 60); // 1 s, 1 s, 2 s

describe('FakeNotePlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls onEvent in order at each event time, then onEnd', async () => {
    const player = new FakeNotePlayer();
    const seen: (number | 'end')[] = [];
    await player.play(schedule, { onEvent: (i) => seen.push(i), onEnd: () => seen.push('end') });
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(seen).toEqual([0, 1, 2, 'end']);
    expect(player.calls).toEqual([{ kind: 'load' }, { kind: 'play', notes: ['C4', null, 'E4'] }]);
  });

  it('stop cancels everything still to come', async () => {
    const player = new FakeNotePlayer();
    const onEvent = vi.fn();
    const onEnd = vi.fn();
    await player.play(schedule, { onEvent, onEnd });
    await vi.advanceTimersByTimeAsync(500);
    player.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(player.calls.at(-1)).toEqual({ kind: 'stop' });
  });

  it('loads once and records previews', async () => {
    const player = new FakeNotePlayer();
    await player.load();
    await player.load();
    player.preview('G4');
    expect(player.calls).toEqual([{ kind: 'load' }, { kind: 'preview', note: 'G4' }]);
  });

  it('can pretend audio is unavailable, and lets a later load try again', async () => {
    const player = new FakeNotePlayer({ failLoad: true });
    await expect(player.load()).rejects.toThrow(FAKE_LOAD_ERROR);
    await expect(player.play(schedule, { onEvent: vi.fn(), onEnd: vi.fn() })).rejects.toThrow(
      FAKE_LOAD_ERROR,
    );
    expect(player.calls.filter((c) => c.kind === 'load')).toHaveLength(2);
  });
});
