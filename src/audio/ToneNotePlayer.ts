import { scheduleEnd, type ScheduledEvent } from '../core/playback/schedule';
import { loadTone } from './loadTone';
import { PREVIEW_SECONDS, type NotePlayer, type PlaybackHandlers } from './NotePlayer';
import type { SamplerLike, ToneLike } from './toneLike';

/** Salamander Grand Piano samples bundled in public/samples/piano (CC-BY 3.0). Tone pitch-shifts between them. */
export const PIANO_SAMPLES: Readonly<Record<string, string>> = {
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
};

export const SAMPLE_BASE_URL = `${import.meta.env.BASE_URL}samples/piano/`;

/** Notes are released a touch early so repeated notes are heard as separate notes. */
const LEGATO = 0.92;

type GestureTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
/** The only events iOS WebKit accepts as activation for AudioContext.resume(). */
const UNLOCK_EVENTS = ['touchend', 'click', 'keydown'] as const;

interface Ready {
  tone: ToneLike;
  sampler: SamplerLike;
}

export class ToneNotePlayer implements NotePlayer {
  /** Set as soon as Tone is imported, so play/preview can resume audio inside the gesture. */
  private tone: ToneLike | null = null;
  private toneLoading: Promise<ToneLike> | null = null;
  private ready: Ready | null = null;
  private loading: Promise<Ready> | null = null;
  /** Bumped by every play and stop, so a play still awaiting the load knows it was cancelled. */
  private token = 0;

  private unlockArmed = false;

  constructor(
    private readonly loadToneApi: () => Promise<ToneLike> = loadTone,
    private readonly baseUrl: string = SAMPLE_BASE_URL,
    /** Where to listen for the first gesture that may unlock audio; null without a window. */
    private readonly gestureTarget: GestureTarget | null = typeof window === 'undefined'
      ? null
      : window,
  ) {}

  prefetch(): void {
    this.loadToneOnce().catch(() => undefined);
    this.armUnlock();
  }

  /**
   * iOS WebKit only lets touchend, click and keydown resume an AudioContext. The first touch is
   * often a note tap or drag, which previews on pointerdown/move and so can't unlock audio; resume
   * on the first real gesture instead, until the context is running.
   */
  private armUnlock(): void {
    const target = this.gestureTarget;
    if (!target || this.unlockArmed) return;
    this.unlockArmed = true;
    let done = false;
    const onGesture = () => {
      const tone = this.tone;
      if (done || !tone) return; // Tone not imported yet: try again on the next gesture
      // Synchronous start() inside the gesture; it may settle later, or never (iOS outside one).
      tone.start().then(
        () => {
          if (tone.isRunning()) disarm();
        },
        () => undefined,
      );
      if (tone.isRunning()) disarm();
    };
    const disarm = () => {
      done = true;
      for (const type of UNLOCK_EVENTS) target.removeEventListener(type, onGesture, true);
    };
    for (const type of UNLOCK_EVENTS) {
      target.addEventListener(type, onGesture, { capture: true, passive: true });
    }
  }

  async load(): Promise<void> {
    await this.loadReady();
  }

  async play(schedule: ScheduledEvent[], handlers: PlaybackHandlers): Promise<void> {
    this.resume(); // before any await: this is still inside the click / key press
    this.stop();
    const token = ++this.token;
    const { tone, sampler } = await this.loadReady();
    if (token !== this.token) return;
    this.resume();
    for (const event of schedule) {
      tone.scheduleOnce((time) => {
        if (event.note) sampler.triggerAttackRelease(event.note, event.duration * LEGATO, time);
        tone.draw(() => handlers.onEvent(event.eventIndex), time);
      }, event.time);
    }
    // Not via draw(): Tone.Draw drops late callbacks and pauses in background tabs.
    tone.scheduleOnce(() => {
      setTimeout(() => {
        if (token !== this.token) return;
        tone.stopTransport();
        handlers.onEnd();
      }, 0);
    }, scheduleEnd(schedule));
    tone.startTransport();
  }

  stop(): void {
    this.token++;
    if (!this.ready) return;
    this.ready.tone.stopTransport();
    this.ready.sampler.releaseAll();
  }

  preview(note: string): void {
    this.resume();
    if (!this.ready) {
      this.loadReady().catch(() => undefined);
      return;
    }
    this.ready.sampler.triggerAttackRelease(note, PREVIEW_SECONDS);
  }

  /** Ask the AudioContext to resume without waiting: outside a gesture it may never settle. */
  private resume(): void {
    this.tone?.start().catch(() => undefined);
  }

  private loadToneOnce(): Promise<ToneLike> {
    if (!this.toneLoading) {
      const loading = this.loadToneApi().then((tone) => {
        this.tone = tone;
        return tone;
      });
      this.toneLoading = loading;
      loading.catch(() => {
        if (this.toneLoading === loading) this.toneLoading = null;
      });
    }
    return this.toneLoading;
  }

  private loadReady(): Promise<Ready> {
    if (!this.loading) {
      const loading = (async () => {
        const tone = await this.loadToneOnce();
        this.resume();
        const sampler = await tone.loadSampler({ ...PIANO_SAMPLES }, this.baseUrl);
        this.ready = { tone, sampler };
        return this.ready;
      })();
      this.loading = loading;
      loading.catch(() => {
        // Start over next time, Tone included (a retry may get a working instance).
        if (this.loading !== loading) return;
        this.loading = null;
        this.toneLoading = null;
        this.tone = null;
      });
    }
    return this.loading;
  }
}
