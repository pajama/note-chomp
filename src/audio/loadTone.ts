import type { SamplerLike, ToneLike } from './toneLike';

/** Loads Tone.js on first use (its own chunk) and adapts it to ToneLike. */
export async function loadTone(): Promise<ToneLike> {
  const Tone = await import('tone');
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
          onerror: (error) => reject(error),
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
