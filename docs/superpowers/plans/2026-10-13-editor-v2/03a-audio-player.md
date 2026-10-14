# Phase 3a — Audio layer: interface, fake & lint rules (Task 8)

`src/audio` is a new layer: it may import only `src/core` and `tone`. Read `00-index.md` → Global Constraints first.

### Task 8: NotePlayer, FakeNotePlayer & audio layer rules

**Files:**
- Create: `src/audio/NotePlayer.ts`, `src/audio/FakeNotePlayer.ts`
- Modify (full replacement): `eslint.config.js`
- Test: `src/audio/FakeNotePlayer.test.ts`

**Interfaces:**
- Consumes: `ScheduledEvent`, `scheduleEnd`, `buildSchedule` (Task 2).
- Produces (used by Tasks 9–11, 15, 23–24):
  - `interface PlaybackHandlers { onEvent(eventIndex: number): void; onEnd(): void }`
  - `interface NotePlayer { prefetch(): void; load(): Promise<void>; play(schedule: ScheduledEvent[], handlers: PlaybackHandlers): Promise<void>; stop(): void; preview(note: string): void }` (spec §2.3, plus `prefetch`: fetch the audio code without touching the AudioContext, so the first gesture can resume audio synchronously — iOS Safari only allows that inside the gesture)
  - `PREVIEW_SECONDS = 0.4`
  - `type PlayerCall = { kind: 'load' } | { kind: 'play'; notes: (string | null)[] } | { kind: 'stop' } | { kind: 'preview'; note: string }`
  - `class FakeNotePlayer implements NotePlayer` — `constructor(options?: { failLoad?: boolean })`, `readonly calls: PlayerCall[]`; `load()` records `{kind:'load'}` once per (successful or pending) load and rejects with `FAKE_LOAD_ERROR` when `failLoad` (a later call tries again); `play()` awaits `load()`, records the notes, then fires `onEvent` at each `time` and `onEnd` at `scheduleEnd` with real `setTimeout`s; `stop()` cancels them and records `{kind:'stop'}`; `preview()` records `{kind:'preview', note}`; `prefetch()` does nothing (and records nothing).
  - `FAKE_LOAD_ERROR = 'Fake audio failed to load'`
  - ESLint: `src/audio/**` may not import React, `formats`, `render`, `export`, `persistence`, `app`, `songs`, `scripts`; `core`, `formats`, `render`, `export`, `persistence`, `songs` and `main.tsx` may not import `tone`/`tone/*`; `core`/`formats`/`render`/`export`/`persistence` may not import `audio`.

- [ ] **Step 1: Write the failing test**

**Create `src/audio/FakeNotePlayer.test.ts`:**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptySong, note, rest } from '../core/model/factories';
import { buildSchedule } from '../core/playback/schedule';
import { FAKE_LOAD_ERROR, FakeNotePlayer } from './FakeNotePlayer';

const song = {
  ...createEmptySong('T'),
  events: [note('C', 4, 'q'), rest('q'), note('E', 4, 'h')],
};
const schedule = buildSchedule(song, 60); // 1 s, 1 s, 2 s

describe('FakeNotePlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls onEvent in order at each event time, then onEnd', async () => {
    const player = new FakeNotePlayer();
    const seen: (number | 'end')[] = [];
    await player.play(schedule, { onEvent: (i) => seen.push(i), onEnd: () => seen.push('end') });
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual([0, 1]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(seen).toEqual([0, 1, 2, 'end']);
    expect(player.calls).toEqual([{ kind: 'load' }, { kind: 'play', notes: ['C4', null, 'E4'] }]);
  });

  it('stop cancels everything still to come', async () => {
    const player = new FakeNotePlayer();
    const onEvent = vi.fn();
    const onEnd = vi.fn();
    await player.play(schedule, { onEvent, onEnd });
    await vi.advanceTimersByTimeAsync(500);
    player.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(player.calls.at(-1)).toEqual({ kind: 'stop' });
  });

  it('loads once and records previews', async () => {
    const player = new FakeNotePlayer();
    await player.load();
    await player.load();
    player.preview('G4');
    expect(player.calls).toEqual([{ kind: 'load' }, { kind: 'preview', note: 'G4' }]);
  });

  it('can pretend audio is unavailable, and lets a later load try again', async () => {
    const player = new FakeNotePlayer({ failLoad: true });
    await expect(player.load()).rejects.toThrow(FAKE_LOAD_ERROR);
    await expect(player.play(schedule, { onEvent: vi.fn(), onEnd: vi.fn() })).rejects.toThrow(
      FAKE_LOAD_ERROR,
    );
    expect(player.calls.filter((c) => c.kind === 'load')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/audio`
Expected: FAIL — `Failed to resolve import "./FakeNotePlayer"`.

- [ ] **Step 3: Implement the interface and the fake**

**Create `src/audio/NotePlayer.ts`:**

```ts
import type { ScheduledEvent } from '../core/playback/schedule';

export interface PlaybackHandlers {
  onEvent(eventIndex: number): void;
  onEnd(): void;
}

/** Plays notes. Implementations: ToneNotePlayer (real piano), FakeNotePlayer (tests). */
export interface NotePlayer {
  /**
   * Fetch the audio code in the background (no sound, no AudioContext), so a later gesture can
   * resume audio synchronously. Never throws.
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
```

**Create `src/audio/FakeNotePlayer.ts`:**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/audio`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the audio layer rules to ESLint**

**Replace `eslint.config.js` with:**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const SCRIPTS = ['**/scripts', '**/scripts/**'];
const REACT = ['react', 'react-dom', 'react-dom/*'];
const TONE = ['tone', 'tone/*'];
const layer = (names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);

const forbid = (patterns) => ({
  'no-restricted-imports': ['error', { patterns: patterns.map((group) => ({ group: [group] })) }],
  'no-restricted-properties': [
    'error',
    { object: 'process', property: 'env', message: 'No env access in src/' },
  ],
});

const LAYERS = [
  'src/core/**',
  'src/formats/**',
  'src/render/**',
  'src/export/**',
  'src/persistence/**',
  'src/audio/**',
];
const DOM_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'DOMParser',
  'Element',
  'HTMLElement',
  'Blob',
  'URL',
].map((name) => ({ name, message: 'src/core must stay free of browser APIs.' }));

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results', 'art-concepts', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // app, songs, main.tsx: may import every layer, but never scripts/ or env.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: LAYERS,
    rules: forbid(SCRIPTS),
  },
  // Only src/audio and src/app may touch Tone.js.
  {
    files: ['src/songs/**/*.{ts,tsx}', 'src/main.tsx'],
    rules: forbid([...TONE, ...SCRIPTS]),
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      ...forbid([
        ...REACT,
        ...layer(['formats', 'render', 'export', 'persistence', 'app', 'songs', 'audio']),
        ...TONE,
        ...SCRIPTS,
      ]),
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
    },
  },
  {
    files: ['src/formats/**/*.{ts,tsx}'],
    rules: forbid([
      ...REACT,
      ...layer(['render', 'export', 'persistence', 'app', 'songs', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  {
    files: ['src/render/**/*.{ts,tsx}'],
    rules: forbid([
      ...layer(['app', 'persistence', 'export', 'formats', 'songs', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  {
    files: ['src/export/**/*.{ts,tsx}'],
    rules: forbid([
      ...layer(['app', 'persistence', 'songs', 'formats', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  {
    files: ['src/persistence/**/*.{ts,tsx}'],
    rules: forbid([
      ...REACT,
      ...layer(['app', 'render', 'export', 'songs', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  // audio: Tone.js + core only.
  {
    files: ['src/audio/**/*.{ts,tsx}'],
    rules: forbid([
      ...REACT,
      ...layer(['formats', 'render', 'export', 'persistence', 'app', 'songs']),
      ...SCRIPTS,
    ]),
  },
);
```

- [ ] **Step 6: Prove the rules bite (probe files), then delete the probes**

```bash
printf "import { start } from 'tone';\nexport const x = start;\n" > src/core/probeTone.ts
printf "import { App } from '../app/App';\nexport const y = App;\n" > src/audio/probeApp.ts
printf "import { FakeNotePlayer } from '../audio/FakeNotePlayer';\nexport const z = FakeNotePlayer;\n" > src/render/probeAudio.ts
printf "import { start } from 'tone';\nexport const w = start;\n" > src/songs/probeTone.ts
npx eslint src/core/probeTone.ts src/audio/probeApp.ts src/render/probeAudio.ts src/songs/probeTone.ts; echo "exit=$?"
rm src/core/probeTone.ts src/audio/probeApp.ts src/render/probeAudio.ts src/songs/probeTone.ts
```

Expected: one or two `no-restricted-imports` errors in **each** of the four probe files ("'tone' import is restricted…", "'../app/App' import is restricted…", "'../audio/FakeNotePlayer' import is restricted…") and `exit=1`. Then `npm run lint` is clean again.

- [ ] **Step 7: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
git add src/audio eslint.config.js
git commit -m "feat(audio): NotePlayer interface, fake player and audio layer lint rules"
```

