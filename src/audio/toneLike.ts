/** The small slice of Tone.js the player uses — real one in loadTone.ts, fakes in tests. */
export interface SamplerLike {
  triggerAttackRelease(note: string, durationSeconds: number, time?: number): void;
  releaseAll(): void;
}

export interface ToneLike {
  /** Resume the AudioContext (must follow a user gesture). */
  start(): Promise<void>;
  /** Resolves once every sample file has loaded; rejects if one fails. */
  loadSampler(urls: Record<string, string>, baseUrl: string): Promise<SamplerLike>;
  /** Transport: call back with the exact audio time, `seconds` after the transport starts. */
  scheduleOnce(callback: (time: number) => void, seconds: number): void;
  /** Run `callback` on the animation frame nearest audio time `time` (Tone.Draw). */
  draw(callback: () => void, time: number): void;
  startTransport(): void;
  /** Stop the transport and forget everything scheduled on it. */
  stopTransport(): void;
}
