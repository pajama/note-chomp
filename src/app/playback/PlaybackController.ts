import type { NotePlayer } from '../../audio/NotePlayer';
import type { Song } from '../../core/model/types';
import { buildSchedule } from '../../core/playback/schedule';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'unavailable';

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  currentEventIndex: number | null;
  error: string | null;
}

export const AUDIO_UNAVAILABLE_MESSAGE =
  "We couldn't load the piano sounds, so playback is off. You can keep editing.";

/** Playback state machine around a NotePlayer, shaped for useSyncExternalStore. */
export class PlaybackController {
  private snapshot: PlaybackSnapshot = { status: 'idle', currentEventIndex: null, error: null };
  private readonly listeners = new Set<() => void>();
  /** Bumped by every play/stop so callbacks from an older run are ignored. */
  private run = 0;
  /** A preview has already asked the player to load (so a load failure is reported once). */
  private previewLoadStarted = false;

  constructor(private readonly player: NotePlayer) {}

  getSnapshot = (): PlaybackSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async play(song: Song, bpm: number, fromIndex = 0): Promise<void> {
    if (this.snapshot.status === 'unavailable') return;
    const run = ++this.run;
    if (this.snapshot.status === 'playing') this.player.stop();
    const schedule = buildSchedule(song, bpm, fromIndex);
    if (schedule.length === 0) {
      this.set({ status: 'idle', currentEventIndex: null });
      return;
    }
    this.set({ status: 'loading', currentEventIndex: null });
    try {
      await this.player.load();
      if (run !== this.run) return;
      this.set({ status: 'playing' });
      await this.player.play(schedule, {
        onEvent: (eventIndex) => {
          if (run === this.run) this.set({ currentEventIndex: eventIndex });
        },
        onEnd: () => {
          if (run === this.run) this.set({ status: 'idle', currentEventIndex: null });
        },
      });
    } catch {
      if (run !== this.run) return;
      this.set({
        status: 'unavailable',
        currentEventIndex: null,
        error: AUDIO_UNAVAILABLE_MESSAGE,
      });
    }
  }

  stop(): void {
    const { status } = this.snapshot;
    if (status !== 'playing' && status !== 'loading') return;
    this.run++;
    this.player.stop();
    this.set({ status: 'idle', currentEventIndex: null });
  }

  preview(note: string): void {
    if (this.snapshot.status === 'unavailable') return;
    this.player.preview(note);
    if (this.previewLoadStarted) return;
    this.previewLoadStarted = true;
    this.player.load().catch(() => {
      if (this.snapshot.status === 'unavailable') return;
      this.run++;
      this.set({
        status: 'unavailable',
        currentEventIndex: null,
        error: AUDIO_UNAVAILABLE_MESSAGE,
      });
    });
  }

  dismissError(): void {
    if (this.snapshot.error !== null) this.set({ error: null });
  }

  private set(next: Partial<PlaybackSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((listener) => listener());
  }
}
