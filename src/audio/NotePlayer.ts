import type { ScheduledEvent } from '../core/playback/schedule';

export interface PlaybackHandlers {
  onEvent(eventIndex: number): void;
  onEnd(): void;
}

/** Plays notes. Implementations: ToneNotePlayer (real piano), FakeNotePlayer (tests). */
export interface NotePlayer {
  /**
   * Fetch the audio code in the background (no sound yet), so a later gesture can resume audio
   * synchronously. Never throws. The Tone player also creates its (suspended) AudioContext here,
   * via Tone.getTransport() in loadTone: that is deliberate, because Tone.start() can only resume
   * an existing context inside the user's gesture. Don't defer it to the first Play.
   */
  prefetch(): void;
  /** Idempotent; the first call loads the instrument. Rejects if audio is unavailable. */
  load(): Promise<void>;
  /** Plays a schedule from its start, replacing anything already playing. */
  play(schedule: ScheduledEvent[], handlers: PlaybackHandlers): Promise<void>;
  /** Stops immediately and releases every voice. */
  stop(): void;
  /** A short audition of one note ('C4'); silent until loaded (but starts loading). */
  preview(note: string): void;
}

/** How long a preview note sounds, in seconds. */
export const PREVIEW_SECONDS = 0.4;
