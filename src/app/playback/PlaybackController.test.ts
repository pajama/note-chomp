import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeNotePlayer } from '../../audio/FakeNotePlayer';
import { createEmptySong, note, rest } from '../../core/model/factories';
import { AUDIO_UNAVAILABLE_MESSAGE, PlaybackController } from './PlaybackController';

const song = {
  ...createEmptySong('T'),
  events: [note('C', 4, 'q'), rest('q'), note('E', 4, 'q')],
};

describe('PlaybackController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('highlights each event in order, then returns to idle', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    const seen: (number | null)[] = [];
    controller.subscribe(() => seen.push(controller.getSnapshot().currentEventIndex));

    const done = controller.play(song, 60);
    expect(controller.getSnapshot().status).toBe('loading');
    await done;
    expect(controller.getSnapshot().status).toBe('playing');
    await vi.advanceTimersByTimeAsync(3000);
    expect(controller.getSnapshot()).toEqual({
      status: 'idle',
      currentEventIndex: null,
      error: null,
    });
    expect(seen.filter((i) => i !== null)).toEqual([0, 1, 2]);
  });

  it('plays from a chosen event', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    await controller.play(song, 60, 2);
    expect(player.calls).toContainEqual({ kind: 'play', notes: ['E4'] });
  });

  it('stop clears the highlight at once and ignores late callbacks', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    await controller.play(song, 60);
    await vi.advanceTimersByTimeAsync(1100);
    expect(controller.getSnapshot().currentEventIndex).toBe(1);
    controller.stop();
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', currentEventIndex: null });
    await vi.advanceTimersByTimeAsync(5000);
    expect(controller.getSnapshot().currentEventIndex).toBeNull();
    expect(player.calls.at(-1)).toEqual({ kind: 'stop' });
  });

  it('stop does nothing when idle', () => {
    const player = new FakeNotePlayer();
    new PlaybackController(player).stop();
    expect(player.calls).toEqual([]);
  });

  it('turns playback off with a friendly error when audio cannot load', async () => {
    const player = new FakeNotePlayer({ failLoad: true });
    const controller = new PlaybackController(player);
    await controller.play(song, 60);
    expect(controller.getSnapshot()).toEqual({
      status: 'unavailable',
      currentEventIndex: null,
      error: AUDIO_UNAVAILABLE_MESSAGE,
    });
    controller.preview('C4');
    await controller.play(song, 60);
    expect(player.calls.filter((c) => c.kind === 'preview' || c.kind === 'play')).toEqual([]);
    controller.dismissError();
    expect(controller.getSnapshot()).toMatchObject({ status: 'unavailable', error: null });
  });

  it('passes previews through, starting the load on the first one', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    controller.preview('G4');
    controller.preview('A4');
    await vi.advanceTimersByTimeAsync(0);
    expect(player.calls).toEqual([
      { kind: 'preview', note: 'G4' },
      { kind: 'load' },
      { kind: 'preview', note: 'A4' },
    ]);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('reports audio that fails to load on a preview, not only on Play', async () => {
    const player = new FakeNotePlayer({ failLoad: true });
    const controller = new PlaybackController(player);
    controller.preview('G4');
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getSnapshot()).toEqual({
      status: 'unavailable',
      currentEventIndex: null,
      error: AUDIO_UNAVAILABLE_MESSAGE,
    });
  });

  it('does nothing for an empty song', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    await controller.play(createEmptySong(), 90);
    expect(controller.getSnapshot().status).toBe('idle');
    expect(player.calls).toEqual([]);
  });
});
