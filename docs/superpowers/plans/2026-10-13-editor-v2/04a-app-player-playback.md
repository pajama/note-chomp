# Phase 4a — App: player service & playback controller (Tasks 10–11)

From here on every task also runs the e2e suite (sandbox disabled for that command; port 5179 free).

### Task 10: Player service, fake-audio switch & e2e fixture

**Files:**
- Create: `src/app/audio.ts`, `e2e/fixtures.ts`
- Modify: `src/app/services.tsx`, `src/main.tsx`, `e2e/editor.spec.ts`, `e2e/import.spec.ts`, `e2e/print.spec.ts`, `e2e/smoke.spec.ts`, `e2e/songbook.spec.ts` (import line only)
- Test: `src/app/audio.test.ts`

**Interfaces:**
- Consumes: `FakeNotePlayer`, `PlayerCall` (Task 8), `ToneNotePlayer` (Task 9), `NotePlayer`.
- Produces (used by Tasks 11, 15, 23–26):
  - `type FakeAudioFlag = true | 'fail-load'`; global `Window.__NOTE_CHOMP_FAKE_AUDIO__?: FakeAudioFlag` and `Window.__NOTE_CHOMP_AUDIO_LOG__?: PlayerCall[]`.
  - `type AudioSwitch = Pick<Window, '__NOTE_CHOMP_FAKE_AUDIO__' | '__NOTE_CHOMP_AUDIO_LOG__'>`
  - `createNotePlayer(win: AudioSwitch): NotePlayer` — fake (and log exposed on `win`) when the flag is set, `ToneNotePlayer` otherwise.
  - `Services` gains `player: NotePlayer`; `main.tsx` passes `createNotePlayer(window)`.
  - `e2e/fixtures.ts`: `test` (Playwright `test` whose `page` always has the fake-audio init script), `expect`, `Page`, `fruits(page)`, `openEditor(page, letters = '', hash = '/#/new')` (goes to the editor, waits for the title box, types the letters, waits for the fruit count).

- [ ] **Step 1: Write the failing test**

**Create `src/app/audio.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { FakeNotePlayer } from '../audio/FakeNotePlayer';
import { ToneNotePlayer } from '../audio/ToneNotePlayer';
import { createNotePlayer, type AudioSwitch } from './audio';

describe('createNotePlayer', () => {
  it('uses the real piano by default', () => {
    expect(createNotePlayer({})).toBeInstanceOf(ToneNotePlayer);
  });

  it('uses a fake player and exposes its log when the e2e switch is on', () => {
    const win: AudioSwitch = { __NOTE_CHOMP_FAKE_AUDIO__: true };
    const player = createNotePlayer(win);
    expect(player).toBeInstanceOf(FakeNotePlayer);
    player.preview('C4');
    expect(win.__NOTE_CHOMP_AUDIO_LOG__).toEqual([{ kind: 'preview', note: 'C4' }]);
  });

  it('can simulate audio that fails to load', async () => {
    const player = createNotePlayer({ __NOTE_CHOMP_FAKE_AUDIO__: 'fail-load' });
    await expect(player.load()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/app/audio.test.ts`
Expected: FAIL — `Failed to resolve import "./audio"`.

- [ ] **Step 3: Implement the switch and the service**

**Create `src/app/audio.ts`:**

```ts
import { FakeNotePlayer, type PlayerCall } from '../audio/FakeNotePlayer';
import type { NotePlayer } from '../audio/NotePlayer';
import { ToneNotePlayer } from '../audio/ToneNotePlayer';

/** Set before the app loads (Playwright addInitScript) to swap the real piano for a fake. */
export type FakeAudioFlag = true | 'fail-load';

declare global {
  interface Window {
    __NOTE_CHOMP_FAKE_AUDIO__?: FakeAudioFlag;
    /** The fake player's call log, for e2e assertions. */
    __NOTE_CHOMP_AUDIO_LOG__?: PlayerCall[];
  }
}

export type AudioSwitch = Pick<Window, '__NOTE_CHOMP_FAKE_AUDIO__' | '__NOTE_CHOMP_AUDIO_LOG__'>;

export function createNotePlayer(win: AudioSwitch): NotePlayer {
  const flag = win.__NOTE_CHOMP_FAKE_AUDIO__;
  if (flag === true || flag === 'fail-load') {
    const fake = new FakeNotePlayer({ failLoad: flag === 'fail-load' });
    win.__NOTE_CHOMP_AUDIO_LOG__ = fake.calls;
    return fake;
  }
  return new ToneNotePlayer();
}
```

**Edit `src/app/services.tsx`** — replace:

```tsx
import type { KeyValueStorage, SongRepository } from '../persistence/SongRepository';

export interface Services {
  repository: SongRepository;
  storage: KeyValueStorage;
}
```

with:

```tsx
import type { NotePlayer } from '../audio/NotePlayer';
import type { KeyValueStorage, SongRepository } from '../persistence/SongRepository';

export interface Services {
  repository: SongRepository;
  storage: KeyValueStorage;
  player: NotePlayer;
}
```

**Edit `src/main.tsx`** — replace:

```tsx
import { App } from './app/App';
```

with:

```tsx
import { App } from './app/App';
import { createNotePlayer } from './app/audio';
```

**Edit `src/main.tsx`** — replace:

```tsx
const services: Services = { repository: new LocalStorageSongRepository(storage), storage };
```

with:

```tsx
const services: Services = {
  repository: new LocalStorageSongRepository(storage),
  storage,
  player: createNotePlayer(window),
};
```

- [ ] **Step 4: Run the unit tests**

Run: `timeout 120 npx vitest run src/app`
Expected: PASS (3 new tests).

- [ ] **Step 5: Make every e2e spec use fake audio**

**Create `e2e/fixtures.ts`:**

```ts
import { expect, test as base, type Page } from '@playwright/test';

export { expect, type Page };

/** Every e2e test runs with the fake audio player (no Tone.js, no sample downloads). */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      window.__NOTE_CHOMP_FAKE_AUDIO__ ??= true;
    });
    await provide(page);
  },
});

export const fruits = (page: Page) => page.getByTestId('song-pages').locator('[data-kind="fruit"]');

/** Open the editor at `hash`, wait until it is ready for keys, then type `letters`. */
export async function openEditor(page: Page, letters = '', hash = '/#/new') {
  await page.goto(hash);
  await expect(page.getByLabel('Song title')).toBeVisible();
  const before = await fruits(page).count();
  for (const letter of letters) await page.keyboard.press(letter);
  await expect(fruits(page)).toHaveCount(before + letters.length);
}
```

**Edit `e2e/editor.spec.ts`** — replace:

```ts
import { expect, test, type Page } from '@playwright/test';
```

with:

```ts
import { expect, test, type Page } from './fixtures';
```

**Edit `e2e/print.spec.ts`** — replace:

```ts
import { expect, test, type Page } from '@playwright/test';
```

with:

```ts
import { expect, test, type Page } from './fixtures';
```

**Edit `e2e/import.spec.ts`** — replace:

```ts
import { expect, test } from '@playwright/test';
```

with:

```ts
import { expect, test } from './fixtures';
```

**Edit `e2e/smoke.spec.ts`** — replace:

```ts
import { expect, test } from '@playwright/test';
```

with:

```ts
import { expect, test } from './fixtures';
```

**Edit `e2e/songbook.spec.ts`** — replace:

```ts
import { expect, test } from '@playwright/test';
```

with:

```ts
import { expect, test } from './fixtures';
```

(The fixture's parameter is named `provide`, not `use`, because the `react-hooks/rules-of-hooks` lint rule treats any function called `use` as a hook.)

- [ ] **Step 6: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
lsof -iTCP:5179 -sTCP:LISTEN   # must print nothing
timeout 600 npm run test:e2e   # sandbox disabled
```

Expected: unit tests pass; all 25 v1 e2e tests pass.

```bash
git add src/app/audio.ts src/app/audio.test.ts src/app/services.tsx src/main.tsx e2e
git commit -m "feat(app): note player service with an e2e fake-audio switch"
```

---

### Task 11: PlaybackController & usePlayback

**Files:**
- Create: `src/app/playback/PlaybackController.ts`, `src/app/hooks/usePlayback.ts`
- Test: `src/app/playback/PlaybackController.test.ts`

**Interfaces:**
- Consumes: `NotePlayer` (Task 8), `buildSchedule`, `BPM_RANGE` (Task 2), `useServices().player` (Task 10).
- Produces (used by Tasks 12, 15, 17):
  - `type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'unavailable'`
  - `interface PlaybackSnapshot { status: PlaybackStatus; currentEventIndex: number | null; error: string | null }`
  - `AUDIO_UNAVAILABLE_MESSAGE = "We couldn't load the piano sounds, so playback is off. You can keep editing."`
  - `class PlaybackController` — `constructor(player: NotePlayer)`; `getSnapshot()`, `subscribe(listener)` (for `useSyncExternalStore`); `play(song, bpm, fromIndex = 0): Promise<void>` (`loading` → `playing` → highlight each event → `idle`; a load/play failure → `unavailable` + error; empty schedule → stays idle); `stop()` (immediate, ignores late callbacks, no-op when idle); `preview(note)` (ignored when unavailable; the first preview also calls `player.load()`, and a failure there → `unavailable` + error toast, just like a failed Play); `dismissError()`.
  - `usePlayback(song: Song): Playback` with `interface Playback { status; playing: boolean /* playing or loading */; currentEventIndex: number | null; error: string | null; bpm: number; setBpm(bpm: number): void; play(fromIndex?: number): void; stop(): void; preview(note: string): void; dismissError(): void }`. Any change to `song.events` or `song.timeSignature` while playing stops playback (title edits don't); unmount stops. On mount it calls `player.prefetch()` so Tone's code is already there when the first Play/preview gesture needs to resume audio.

- [ ] **Step 1: Write the failing test**

**Create `src/app/playback/PlaybackController.test.ts`:**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeNotePlayer } from '../../audio/FakeNotePlayer';
import { createEmptySong, note, rest } from '../../core/model/factories';
import { AUDIO_UNAVAILABLE_MESSAGE, PlaybackController } from './PlaybackController';

const song = {
  ...createEmptySong('T'),
  events: [note('C', 4, 'q'), rest('q'), note('E', 4, 'q')],
};

describe('PlaybackController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('highlights each event in order, then returns to idle', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    const seen: (number | null)[] = [];
    controller.subscribe(() => seen.push(controller.getSnapshot().currentEventIndex));

    const done = controller.play(song, 60);
    expect(controller.getSnapshot().status).toBe('loading');
    await done;
    expect(controller.getSnapshot().status).toBe('playing');
    await vi.advanceTimersByTimeAsync(3000);
    expect(controller.getSnapshot()).toEqual({
      status: 'idle',
      currentEventIndex: null,
      error: null,
    });
    expect(seen.filter((i) => i !== null)).toEqual([0, 1, 2]);
  });

  it('plays from a chosen event', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    await controller.play(song, 60, 2);
    expect(player.calls).toContainEqual({ kind: 'play', notes: ['E4'] });
  });

  it('stop clears the highlight at once and ignores late callbacks', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    await controller.play(song, 60);
    await vi.advanceTimersByTimeAsync(1100);
    expect(controller.getSnapshot().currentEventIndex).toBe(1);
    controller.stop();
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', currentEventIndex: null });
    await vi.advanceTimersByTimeAsync(5000);
    expect(controller.getSnapshot().currentEventIndex).toBeNull();
    expect(player.calls.at(-1)).toEqual({ kind: 'stop' });
  });

  it('stop does nothing when idle', () => {
    const player = new FakeNotePlayer();
    new PlaybackController(player).stop();
    expect(player.calls).toEqual([]);
  });

  it('turns playback off with a friendly error when audio cannot load', async () => {
    const player = new FakeNotePlayer({ failLoad: true });
    const controller = new PlaybackController(player);
    await controller.play(song, 60);
    expect(controller.getSnapshot()).toEqual({
      status: 'unavailable',
      currentEventIndex: null,
      error: AUDIO_UNAVAILABLE_MESSAGE,
    });
    controller.preview('C4');
    await controller.play(song, 60);
    expect(player.calls.filter((c) => c.kind === 'preview' || c.kind === 'play')).toEqual([]);
    controller.dismissError();
    expect(controller.getSnapshot()).toMatchObject({ status: 'unavailable', error: null });
  });

  it('passes previews through, starting the load on the first one', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    controller.preview('G4');
    controller.preview('A4');
    await vi.advanceTimersByTimeAsync(0);
    expect(player.calls).toEqual([
      { kind: 'preview', note: 'G4' },
      { kind: 'load' },
      { kind: 'preview', note: 'A4' },
    ]);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('reports audio that fails to load on a preview, not only on Play', async () => {
    const player = new FakeNotePlayer({ failLoad: true });
    const controller = new PlaybackController(player);
    controller.preview('G4');
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getSnapshot()).toEqual({
      status: 'unavailable',
      currentEventIndex: null,
      error: AUDIO_UNAVAILABLE_MESSAGE,
    });
  });

  it('does nothing for an empty song', async () => {
    const player = new FakeNotePlayer();
    const controller = new PlaybackController(player);
    await controller.play(createEmptySong(), 90);
    expect(controller.getSnapshot().status).toBe('idle');
    expect(player.calls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `timeout 120 npx vitest run src/app/playback`
Expected: FAIL — `Failed to resolve import "./PlaybackController"`.

- [ ] **Step 3: Implement the controller**

**Create `src/app/playback/PlaybackController.ts`:**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/app/playback`
Expected: PASS (8 tests).

- [ ] **Step 5: Add the hook**

**Create `src/app/hooks/usePlayback.ts`:**

```ts
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Song } from '../../core/model/types';
import { BPM_RANGE } from '../../core/playback/schedule';
import { PlaybackController, type PlaybackStatus } from '../playback/PlaybackController';
import { useServices } from '../services';

export interface Playback {
  status: PlaybackStatus;
  playing: boolean;
  currentEventIndex: number | null;
  error: string | null;
  bpm: number;
  setBpm: (bpm: number) => void;
  play: (fromIndex?: number) => void;
  stop: () => void;
  preview: (note: string) => void;
  dismissError: () => void;
}

export function usePlayback(song: Song): Playback {
  const { player } = useServices();
  const controller = useMemo(() => new PlaybackController(player), [player]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [bpm, setBpm] = useState<number>(BPM_RANGE.default);

  // Any edit while playing stops playback (a title change is not an edit to the music).
  const music = useRef({ events: song.events, timeSignature: song.timeSignature });
  useEffect(() => {
    const before = music.current;
    if (before.events === song.events && before.timeSignature === song.timeSignature) return;
    music.current = { events: song.events, timeSignature: song.timeSignature };
    controller.stop();
  }, [song.events, song.timeSignature, controller]);

  useEffect(() => () => controller.stop(), [controller]);
  // Fetch Tone's code now (no sound yet), so the first Play can resume audio inside the gesture.
  useEffect(() => player.prefetch(), [player]);

  const play = useCallback(
    (fromIndex = 0) => void controller.play(song, bpm, fromIndex),
    [controller, song, bpm],
  );
  const stop = useCallback(() => controller.stop(), [controller]);
  const preview = useCallback((note: string) => controller.preview(note), [controller]);
  const dismissError = useCallback(() => controller.dismissError(), [controller]);

  return {
    status: snapshot.status,
    playing: snapshot.status === 'playing' || snapshot.status === 'loading',
    currentEventIndex: snapshot.currentEventIndex,
    error: snapshot.error,
    bpm,
    setBpm,
    play,
    stop,
    preview,
    dismissError,
  };
}
```

The hook is a thin binding (no React test renderer in this repo); its behaviour is covered by the controller tests above and the playback e2e spec (Task 24).

- [ ] **Step 6: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
git add src/app/playback src/app/hooks/usePlayback.ts
git commit -m "feat(app): playback controller and usePlayback hook"
```

