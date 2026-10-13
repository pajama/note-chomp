# Phase 3b — Audio layer: Tone.js piano (Task 9)

`src/audio` is a new layer: it may import only `src/core` and `tone`. Read `00-index.md` → Global Constraints first.

### Task 9: ToneNotePlayer with bundled piano samples

**Files:**
- Modify: `package.json`, `package-lock.json` (add `tone`)
- Create: `public/samples/piano/{Fs3,A3,C4,Ds4,Fs4,A4,C5,Ds5,Fs5,A5,C6}.mp3`, `public/samples/piano/ATTRIBUTION.txt`
- Create: `src/audio/toneLike.ts`, `src/audio/loadTone.ts`, `src/audio/ToneNotePlayer.ts`
- Test: `src/audio/ToneNotePlayer.test.ts`

**Interfaces:**
- Consumes: Task 8 `NotePlayer`, `PlaybackHandlers`, `PREVIEW_SECONDS`; Task 2 `ScheduledEvent`, `scheduleEnd`. Tone 15 API used only in `loadTone.ts`: `Tone.start()`, `new Tone.Sampler({ urls, baseUrl, release, onload, onerror }).toDestination()`, `Tone.getTransport()` (`scheduleOnce(cb, seconds)`, `start('+0.05')`, `stop()`, `cancel(0)`), `Tone.getDraw()` (`schedule(cb, time)`, `cancel(0)`), `sampler.triggerAttackRelease(note, seconds, time?)`, `sampler.releaseAll()`.
- Produces (used by Task 10):
  - `interface SamplerLike { triggerAttackRelease(note: string, durationSeconds: number, time?: number): void; releaseAll(): void }`
  - `interface ToneLike { start(): Promise<void>; loadSampler(urls: Record<string, string>, baseUrl: string): Promise<SamplerLike>; scheduleOnce(callback: (time: number) => void, seconds: number): void; draw(callback: () => void, time: number): void; startTransport(): void; stopTransport(): void }`
  - `loadTone(): Promise<ToneLike>` (the only `import('tone')` in the app).
  - `PIANO_SAMPLES: Readonly<Record<string, string>>` (note → file), `SAMPLE_BASE_URL = \`${import.meta.env.BASE_URL}samples/piano/\``
  - `class ToneNotePlayer implements NotePlayer` — `constructor(loadToneApi: () => Promise<ToneLike> = loadTone, baseUrl: string = SAMPLE_BASE_URL)`. `load()` is idempotent (Tone + samples loaded once; a failure lets the next call retry). `play()` stops anything playing, schedules every event on the Transport (`triggerAttackRelease` at the exact audio time, highlight via `draw`), then `onEnd` at `scheduleEnd`, and starts the Transport. `stop()` stops the Transport and releases every voice (no-op before load). `preview(note)` plays `PREVIEW_SECONDS`; before load it only starts loading.

- [ ] **Step 1: Add Tone.js**

```bash
timeout 300 npm install tone@^15.1.22
```

Expected: `package.json` `dependencies` gains `"tone": "^15.1.22"`; `npm ls tone` prints `tone@15.x`.

- [ ] **Step 2: Download the Salamander samples**

```bash
mkdir -p public/samples/piano
for n in Fs3 A3 C4 Ds4 Fs4 A4 C5 Ds5 Fs5 A5 C6; do
  curl -fsSL --max-time 30 -o "public/samples/piano/$n.mp3" "https://tonejs.github.io/audio/salamander/$n.mp3" || echo "FAILED $n"
done
file public/samples/piano/*.mp3 | grep -vc 'MPEG ADTS, layer III'
du -ch public/samples/piano/*.mp3 | tail -1
```

Expected: no `FAILED` lines; the `grep -vc` count prints `0` (every file is an MP3: `Audio file with ID3 version 2.3.0, contains: MPEG ADTS, layer III, v1, 128 kbps, 44.1 kHz`); total about `692K` (must be ≤ 1.0M).

**Create `public/samples/piano/ATTRIBUTION.txt`:**

```text
Piano samples: Salamander Grand Piano V3 by Alexander Holm
https://archive.org/details/SalamanderGrandPianoV3
License: Creative Commons Attribution 3.0 (CC BY 3.0) — https://creativecommons.org/licenses/by/3.0/

The MP3 files in this folder (Fs3, A3, C4, Ds4, Fs4, A4, C5, Ds5, Fs5, A5, C6) are the Tone.js
project's conversions, downloaded unmodified from https://tonejs.github.io/audio/salamander/.
```

- [ ] **Step 3: Write the failing test**

**Create `src/audio/ToneNotePlayer.test.ts`:**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createEmptySong, note, rest } from '../core/model/factories';
import { buildSchedule } from '../core/playback/schedule';
import { PREVIEW_SECONDS } from './NotePlayer';
import { PIANO_SAMPLES, ToneNotePlayer } from './ToneNotePlayer';
import type { SamplerLike, ToneLike } from './toneLike';

function fakeTone(options: { failSamples?: boolean } = {}) {
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
    start: vi.fn(async () => {}),
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
    expect(seen).toEqual([0, 1, 2, 'end']);
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
```

- [ ] **Step 4: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/audio/ToneNotePlayer.test.ts`
Expected: FAIL — `Failed to resolve import "./ToneNotePlayer"`.

- [ ] **Step 5: Implement**

**Create `src/audio/toneLike.ts`:**

```ts
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
```

**Create `src/audio/loadTone.ts`:**

```ts
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
```

**Create `src/audio/ToneNotePlayer.ts`:**

```ts
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

interface Ready {
  tone: ToneLike;
  sampler: SamplerLike;
}

export class ToneNotePlayer implements NotePlayer {
  private ready: Ready | null = null;
  private loading: Promise<Ready> | null = null;

  constructor(
    private readonly loadToneApi: () => Promise<ToneLike> = loadTone,
    private readonly baseUrl: string = SAMPLE_BASE_URL,
  ) {}

  async load(): Promise<void> {
    await this.loadReady();
  }

  async play(schedule: ScheduledEvent[], handlers: PlaybackHandlers): Promise<void> {
    const { tone, sampler } = await this.loadReady();
    this.stop();
    await tone.start();
    for (const event of schedule) {
      tone.scheduleOnce((time) => {
        if (event.note) sampler.triggerAttackRelease(event.note, event.duration * LEGATO, time);
        tone.draw(() => handlers.onEvent(event.eventIndex), time);
      }, event.time);
    }
    tone.scheduleOnce((time) => tone.draw(() => handlers.onEnd(), time), scheduleEnd(schedule));
    tone.startTransport();
  }

  stop(): void {
    if (!this.ready) return;
    this.ready.tone.stopTransport();
    this.ready.sampler.releaseAll();
  }

  preview(note: string): void {
    if (!this.ready) {
      this.loadReady().catch(() => undefined);
      return;
    }
    this.ready.sampler.triggerAttackRelease(note, PREVIEW_SECONDS);
  }

  private loadReady(): Promise<Ready> {
    this.loading ??= (async () => {
      const tone = await this.loadToneApi();
      await tone.start();
      const sampler = await tone.loadSampler({ ...PIANO_SAMPLES }, this.baseUrl);
      this.ready = { tone, sampler };
      return this.ready;
    })();
    this.loading.catch(() => {
      this.loading = null;
    });
    return this.loading;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/audio`
Expected: PASS (10 tests). `loadTone.ts` has no unit test (it needs a real AudioContext); it is type-checked against Tone's own types here and exercised for real in Task 26.

- [ ] **Step 7: Verify everything (including that Tone gets its own chunk) and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 300 npm run build
ls dist/samples/piano | wc -l
```

Expected: build succeeds; the output lists a separate chunk for Tone (≈ 340 kB, e.g. `dist/assets/esm-*.js`) and the main `index-*.js` does not grow by that much; `ls` counts `12` files in `dist/samples/piano` (11 mp3 + `ATTRIBUTION.txt`). (The pre-existing "chunks larger than 500 kB" warning is unchanged from v1.)

```bash
git add package.json package-lock.json public/samples/piano src/audio
git commit -m "feat(audio): Tone.js piano player with bundled Salamander samples"
```
