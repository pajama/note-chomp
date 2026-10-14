import { describe, expect, it, vi } from 'vitest';
import { createEmptySong, note, rest } from '../core/model/factories';
import { buildSchedule } from '../core/playback/schedule';
import { PREVIEW_SECONDS } from './NotePlayer';
import { PIANO_SAMPLES, ToneNotePlayer } from './ToneNotePlayer';
import type { SamplerLike, ToneLike } from './toneLike';

function fakeTone(options: { failSamples?: boolean; hangStart?: boolean } = {}) {
  const sampler: SamplerLike & {
    played: [string, number, number | undefined][];
    released: number;
  } = {
    played: [],
    released: 0,
    triggerAttackRelease(n, d, t) {
      this.played.push([n, d, t]);
    },
    releaseAll() {
      this.released++;
    },
  };
  const scheduled: { callback: (time: number) => void; seconds: number }[] = [];
  const tone = {
    // hangStart: a resume() outside a user gesture on iOS Safari never settles.
    start: vi.fn(() => (options.hangStart ? new Promise<void>(() => {}) : Promise.resolve())),
    loadSampler: vi.fn(async () => {
      if (options.failSamples) throw new Error('404');
      return sampler;
    }),
    scheduleOnce: (callback: (time: number) => void, seconds: number) => {
      scheduled.push({ callback, seconds });
    },
    draw: (callback: () => void) => callback(),
    startTransport: vi.fn(),
    stopTransport: vi.fn(() => {
      scheduled.length = 0;
    }),
    isRunning: vi.fn(() => false),
  } satisfies ToneLike;
  /** Pretend the transport ran to the end: fire every scheduled callback at 100 + its offset. */
  const runTransport = () => [...scheduled].forEach((s) => s.callback(100 + s.seconds));
  return { tone, sampler, scheduled, runTransport };
}

const song = { ...createEmptySong('T'), events: [note('C', 4, 'q'), rest('q'), note('G', 4, 'h')] };

describe('ToneNotePlayer', () => {
  it('loads Tone and the bundled samples once', async () => {
    const { tone } = fakeTone();
    const loadTone = vi.fn(async () => tone);
    const player = new ToneNotePlayer(loadTone, '/samples/piano/');
    await Promise.all([player.load(), player.load()]);
    await player.load();
    expect(loadTone).toHaveBeenCalledTimes(1);
    expect(tone.start).toHaveBeenCalled();
    expect(tone.loadSampler).toHaveBeenCalledWith({ ...PIANO_SAMPLES }, '/samples/piano/');
  });

  it('bundles a sample at least every minor third across G3–C6', () => {
    expect(Object.keys(PIANO_SAMPLES)).toEqual([
      'F#3',
      'A3',
      'C4',
      'D#4',
      'F#4',
      'A4',
      'C5',
      'D#5',
      'F#5',
      'A5',
      'C6',
    ]);
  });

  it('rejects when samples fail, and tries again next time', async () => {
    const failing = fakeTone({ failSamples: true });
    const working = fakeTone();
    const loadTone = vi
      .fn()
      .mockResolvedValueOnce(failing.tone)
      .mockResolvedValueOnce(working.tone);
    const player = new ToneNotePlayer(loadTone);
    await expect(player.load()).rejects.toThrow('404');
    await expect(player.load()).resolves.toBeUndefined();
    expect(loadTone).toHaveBeenCalledTimes(2);
  });

  it('schedules each note on the transport and reports events in sync', async () => {
    const { tone, sampler, scheduled, runTransport } = fakeTone();
    const player = new ToneNotePlayer(async () => tone);
    const seen: (number | 'end')[] = [];
    await player.play(buildSchedule(song, 60), {
      onEvent: (i) => seen.push(i),
      onEnd: () => seen.push('end'),
    });
    expect(scheduled.map((s) => s.seconds)).toEqual([0, 1, 2, 4]);
    expect(tone.startTransport).toHaveBeenCalledTimes(1);
    runTransport();
    expect(seen).toEqual([0, 1, 2]);
    await new Promise((resolve) => setTimeout(resolve, 0)); // the end is reported off the audio thread
    expect(seen).toEqual([0, 1, 2, 'end']);
    expect(tone.stopTransport).toHaveBeenCalledTimes(1); // the transport is stopped at the end
    expect(sampler.played.map(([n, , t]) => [n, t])).toEqual([
      ['C4', 100],
      ['G4', 102],
    ]);
    expect(sampler.played[0][1]).toBeLessThan(1);
  });

  it('stop halts the transport and releases every voice', async () => {
    const { tone, sampler } = fakeTone();
    const player = new ToneNotePlayer(async () => tone);
    player.stop(); // nothing loaded yet: no-op
    expect(tone.stopTransport).not.toHaveBeenCalled();
    await player.play(buildSchedule(song, 60), { onEvent: vi.fn(), onEnd: vi.fn() });
    player.stop();
    expect(tone.stopTransport).toHaveBeenCalled();
    expect(sampler.released).toBeGreaterThan(0);
  });

  it('never waits on the AudioContext, and resumes it again at the start of every play', async () => {
    const { tone } = fakeTone({ hangStart: true });
    const player = new ToneNotePlayer(async () => tone);
    await expect(player.load()).resolves.toBeUndefined();
    const before = tone.start.mock.calls.length;
    const playing = player.play(buildSchedule(song, 60), { onEvent: vi.fn(), onEnd: vi.fn() });
    expect(tone.start).toHaveBeenCalledTimes(before + 1); // synchronously, inside the gesture
    await playing;
    expect(tone.startTransport).toHaveBeenCalledTimes(1);
  });

  it('prefetch imports Tone without touching audio, so the first gesture can resume at once', async () => {
    const { tone } = fakeTone();
    const loadTone = vi.fn(async () => tone);
    const player = new ToneNotePlayer(loadTone);
    player.prefetch();
    player.prefetch();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadTone).toHaveBeenCalledTimes(1);
    expect(tone.start).not.toHaveBeenCalled();
    expect(tone.loadSampler).not.toHaveBeenCalled();
    player.preview('E4');
    expect(tone.start).toHaveBeenCalledTimes(1);
    await player.load();
    expect(loadTone).toHaveBeenCalledTimes(1);
  });

  it('a stop while play() is still loading cancels that play', async () => {
    const { tone } = fakeTone();
    const player = new ToneNotePlayer(async () => tone);
    const onEnd = vi.fn();
    const playing = player.play(buildSchedule(song, 60), { onEvent: vi.fn(), onEnd });
    player.stop();
    await playing;
    expect(tone.startTransport).not.toHaveBeenCalled();
  });

  it('preview is silent until loaded but starts loading', async () => {
    const { tone, sampler } = fakeTone();
    const loadTone = vi.fn(async () => tone);
    const player = new ToneNotePlayer(loadTone);
    player.preview('E4');
    expect(sampler.played).toEqual([]);
    await player.load();
    expect(loadTone).toHaveBeenCalledTimes(1);
    player.preview('E4');
    expect(sampler.played).toEqual([['E4', PREVIEW_SECONDS, undefined]]);
  });
});

describe('ToneNotePlayer audio unlock (iOS: only touchend / click / keydown may resume audio)', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('resumes audio on the first touchend after prefetch, then stops listening', async () => {
    const { tone } = fakeTone();
    tone.isRunning.mockReturnValueOnce(false).mockReturnValue(true);
    const target = new EventTarget();
    const player = new ToneNotePlayer(async () => tone, '/s/', target);
    player.prefetch();
    await flush();
    target.dispatchEvent(new Event('touchend'));
    expect(tone.start).toHaveBeenCalledTimes(1);
    await flush();
    target.dispatchEvent(new Event('touchend'));
    target.dispatchEvent(new Event('click'));
    expect(tone.start).toHaveBeenCalledTimes(1);
  });

  it('keeps listening while the context is still suspended', async () => {
    const { tone } = fakeTone();
    const target = new EventTarget();
    const player = new ToneNotePlayer(async () => tone, '/s/', target);
    player.prefetch();
    await flush();
    target.dispatchEvent(new Event('keydown'));
    await flush();
    target.dispatchEvent(new Event('click'));
    expect(tone.start.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores a gesture before Tone has loaded, and unlocks on the next one', async () => {
    const { tone } = fakeTone();
    tone.isRunning.mockReturnValue(true);
    let finish: (t: ToneLike) => void = () => undefined;
    const target = new EventTarget();
    const player = new ToneNotePlayer(
      () => new Promise<ToneLike>((resolve) => (finish = resolve)),
      '/s/',
      target,
    );
    player.prefetch();
    target.dispatchEvent(new Event('touchend'));
    expect(tone.start).not.toHaveBeenCalled();
    finish(tone);
    await flush();
    target.dispatchEvent(new Event('touchend'));
    expect(tone.start).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a gesture target (no window: SSR, tests)', async () => {
    const { tone } = fakeTone();
    const player = new ToneNotePlayer(async () => tone, '/s/', null);
    expect(() => player.prefetch()).not.toThrow();
    await flush();
    expect(tone.start).not.toHaveBeenCalled();
  });
});
