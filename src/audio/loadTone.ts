import type { SamplerLike, ToneLike } from './toneLike';

/** Loads Tone.js on first use (its own chunk) and adapts it to ToneLike. */
export async function loadTone(): Promise<ToneLike> {
  const Tone = await import('tone');
  // Creates Tone's (suspended) AudioContext now, at prefetch time, on purpose: Tone.start() must
  // find a context to resume inside the Play gesture. See NotePlayer.prefetch.
  const transport = Tone.getTransport();
  const draw = Tone.getDraw();
  return {
    start: () => Tone.start(),
    loadSampler: (urls, baseUrl) =>
      new Promise<SamplerLike>((resolve, reject) => {
        const sampler = new Tone.Sampler({
          urls,
          baseUrl,
          release: 1,
          onload: () => resolve(sampler),
          onerror: (error) => {
            sampler.dispose();
            reject(error);
          },
        }).toDestination();
      }),
    scheduleOnce: (callback, seconds) => {
      transport.scheduleOnce(callback, seconds);
    },
    draw: (callback, time) => {
      draw.schedule(callback, time);
    },
    startTransport: () => {
      transport.start('+0.05');
    },
    stopTransport: () => {
      transport.stop();
      transport.cancel(0);
      draw.cancel(0);
    },
  };
}
