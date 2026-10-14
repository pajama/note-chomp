import { scheduleEnd, type ScheduledEvent } from '../core/playback/schedule';
import type { NotePlayer, PlaybackHandlers } from './NotePlayer';

export type PlayerCall =
  | { kind: 'load' }
  | { kind: 'play'; notes: (string | null)[] }
  | { kind: 'stop' }
  | { kind: 'preview'; note: string };

export interface FakeNotePlayerOptions {
  /** Make load() reject, like a browser without Web Audio. */
  failLoad?: boolean;
}

export const FAKE_LOAD_ERROR = 'Fake audio failed to load';

/** Records every call and "plays" with real timers, so highlight order can be checked. */
export class FakeNotePlayer implements NotePlayer {
  readonly calls: PlayerCall[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private loading: Promise<void> | null = null;

  constructor(private readonly options: FakeNotePlayerOptions = {}) {}

  /** Nothing to fetch; not recorded, so call logs only show what the user did. */
  prefetch(): void {}

  load(): Promise<void> {
    if (!this.loading) {
      this.calls.push({ kind: 'load' });
      this.loading = this.options.failLoad
        ? Promise.reject(new Error(FAKE_LOAD_ERROR))
        : Promise.resolve();
      this.loading.catch(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  async play(schedule: ScheduledEvent[], handlers: PlaybackHandlers): Promise<void> {
    await this.load();
    this.clearTimers();
    this.calls.push({ kind: 'play', notes: schedule.map((e) => e.note) });
    for (const event of schedule) {
      this.timers.push(setTimeout(() => handlers.onEvent(event.eventIndex), event.time * 1000));
    }
    this.timers.push(
      setTimeout(
        () => {
          this.timers = [];
          handlers.onEnd();
        },
        scheduleEnd(schedule) * 1000,
      ),
    );
  }

  stop(): void {
    this.clearTimers();
    this.calls.push({ kind: 'stop' });
  }

  preview(note: string): void {
    this.calls.push({ kind: 'preview', note });
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
