# Phase 4b — App: toast, playback controls & help (Task 12)

From here on every task also runs the e2e suite (sandbox disabled for that command; port 5179 free).

### Task 12: Toast, playback controls & help popover

**Files:**
- Create: `src/app/hooks/useToast.ts`, `src/app/components/Toast.tsx`, `src/app/components/PlaybackControls.tsx`, `src/app/components/HelpPopover.tsx`
- Test: `src/app/components/Toast.test.tsx`, `src/app/components/PlaybackControls.test.tsx`, `src/app/components/HelpPopover.test.tsx`

**Interfaces:**
- Consumes: `PlaybackStatus`, `AUDIO_UNAVAILABLE_MESSAGE` (Task 11), `BPM_RANGE` (Task 2).
- Produces (used by Tasks 14, 15, 20):
  - `type ToastTone = 'error' | 'info'`; `interface ToastMessage { id: number; text: string; tone: ToastTone }`; `useToast(): { toast: ToastMessage | null; show(text: string, tone?: ToastTone): void; dismiss(): void }` (`show` defaults to `'error'`; every call gets a new id so the same text restarts the timer).
  - `TOAST_MS = 4000`; `<Toast message onDismiss />` — always renders `<div class="toast-region" role="status" aria-live="polite">`; a message renders `<div class="toast {tone}" data-testid="toast">text <button>OK</button></div>` and auto-dismisses after `TOAST_MS`.
  - `<PlaybackControls status canPlay bpm onPlay onStop onBpm />` — idle: "▶ Play" (`aria-label="Play"`, disabled when `!canPlay` or unavailable, `title` = `AUDIO_UNAVAILABLE_MESSAGE` when unavailable, else "Play (Space)"); playing: "■ Stop" (`aria-label="Stop"`); loading: "Loading piano…" (`aria-label="Loading piano, press to cancel"`, pressing it cancels); tempo `<input type="range" aria-label="Tempo" min=60 max=160 step=5>` between 🐢 and 🐇.
  - `HELP_LINES: readonly string[]`; `<HelpPopover />` — "?" button (`aria-label="Help"`, `aria-expanded`), opens `role="dialog"` `aria-label="How to use the editor"` listing `HELP_LINES`; closes on the button, Esc (without letting Esc reach the editor shortcuts) or a pointerdown outside.

- [ ] **Step 1: Write the failing tests**

**Create `src/app/components/Toast.test.tsx`:**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Toast } from './Toast';

describe('Toast', () => {
  it('always renders the polite live region', () => {
    const html = renderToStaticMarkup(<Toast message={null} onDismiss={() => {}} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('data-testid="toast"');
  });

  it('shows the message with its tone and an OK button', () => {
    const html = renderToStaticMarkup(
      <Toast message={{ id: 1, text: 'Saved!', tone: 'info' }} onDismiss={() => {}} />,
    );
    expect(html).toContain('class="toast info"');
    expect(html).toContain('Saved!');
    expect(html).toContain('>OK</button>');
  });
});
```

**Create `src/app/components/PlaybackControls.test.tsx`:**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AUDIO_UNAVAILABLE_MESSAGE } from '../playback/PlaybackController';
import { PlaybackControls, type PlaybackControlsProps } from './PlaybackControls';

const props: PlaybackControlsProps = {
  status: 'idle',
  canPlay: true,
  bpm: 90,
  onPlay: () => {},
  onStop: () => {},
  onBpm: () => {},
};
const render = (p: Partial<PlaybackControlsProps> = {}) =>
  renderToStaticMarkup(<PlaybackControls {...props} {...p} />);

describe('PlaybackControls', () => {
  it('offers Play and a 60–160 tempo slider', () => {
    const html = render();
    expect(html).toContain('aria-label="Play"');
    expect(html).toContain('min="60"');
    expect(html).toContain('max="160"');
    expect(html).toContain('value="90"');
  });
  it('shows Stop while playing and a loading label while the piano loads', () => {
    expect(render({ status: 'playing' })).toContain('■ Stop');
    expect(render({ status: 'loading' })).toContain('Loading piano…');
    expect(render({ status: 'loading' })).toContain('aria-label="Loading piano, press to cancel"');
  });
  it('disables Play with an explanation when audio is unavailable', () => {
    const html = render({ status: 'unavailable' });
    expect(html).toContain('disabled=""');
    expect(html).toContain(`title="${AUDIO_UNAVAILABLE_MESSAGE.replace("'", '&#x27;')}"`);
  });
});
```

**Create `src/app/components/HelpPopover.test.tsx`:**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_LINES, HelpPopover } from './HelpPopover';

describe('HelpPopover', () => {
  it('starts closed: just a labelled "?" button', () => {
    const html = renderToStaticMarkup(<HelpPopover />);
    expect(html).toContain('aria-label="Help"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it('covers every way of editing and playing', () => {
    const text = HELP_LINES.join(' ');
    for (const words of ['C–B', 'drag', '← →', 'Shift', 'Backspace', 'Esc', 'Space plays']) {
      expect(text).toContain(words);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `timeout 120 npx vitest run src/app/components`
Expected: FAIL — `Failed to resolve import "./Toast"` / `"./PlaybackControls"` / `"./HelpPopover"`.

- [ ] **Step 3: Implement**

**Create `src/app/hooks/useToast.ts`:**

```ts
import { useCallback, useState } from 'react';

export type ToastTone = 'error' | 'info';

export interface ToastMessage {
  /** Changes on every show(), so the same text shown twice restarts the timer. */
  id: number;
  text: string;
  tone: ToastTone;
}

export interface ToastApi {
  toast: ToastMessage | null;
  show: (text: string, tone?: ToastTone) => void;
  dismiss: () => void;
}

let nextId = 1;

export function useToast(): ToastApi {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const show = useCallback((text: string, tone: ToastTone = 'error') => {
    setToast({ id: nextId++, text, tone });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}
```

**Create `src/app/components/Toast.tsx`:**

```tsx
import { useEffect } from 'react';
import type { ToastMessage } from '../hooks/useToast';

export const TOAST_MS = 4000;

export interface ToastProps {
  message: ToastMessage | null;
  onDismiss: () => void;
}

/** A polite live region just above the dock; messages dismiss themselves after TOAST_MS. */
export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className={`toast ${message.tone}`} data-testid="toast" key={message.id}>
          <span>{message.text}</span>
          <button type="button" className="secondary" onClick={onDismiss}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
```

**Create `src/app/components/PlaybackControls.tsx`:**

```tsx
import { BPM_RANGE } from '../../core/playback/schedule';
import type { PlaybackStatus } from '../playback/PlaybackController';
import { AUDIO_UNAVAILABLE_MESSAGE } from '../playback/PlaybackController';

export interface PlaybackControlsProps {
  status: PlaybackStatus;
  canPlay: boolean;
  bpm: number;
  onPlay: () => void;
  onStop: () => void;
  onBpm: (bpm: number) => void;
}

export function PlaybackControls({
  status,
  canPlay,
  bpm,
  onPlay,
  onStop,
  onBpm,
}: PlaybackControlsProps) {
  const busy = status === 'playing' || status === 'loading';
  return (
    <div className="playback-controls" role="group" aria-label="Playback">
      {busy ? (
        <button
          type="button"
          className="play-button"
          onClick={onStop}
          aria-label={status === 'loading' ? 'Loading piano, press to cancel' : 'Stop'}
        >
          {status === 'loading' ? 'Loading piano…' : '■ Stop'}
        </button>
      ) : (
        <button
          type="button"
          className="play-button"
          aria-label="Play"
          disabled={!canPlay || status === 'unavailable'}
          title={status === 'unavailable' ? AUDIO_UNAVAILABLE_MESSAGE : 'Play (Space)'}
          onClick={onPlay}
        >
          ▶ Play
        </button>
      )}
      <label className="tempo">
        <span aria-hidden="true">🐢</span>
        <input
          type="range"
          aria-label="Tempo"
          min={BPM_RANGE.min}
          max={BPM_RANGE.max}
          step={5}
          value={bpm}
          aria-valuetext={`${bpm} beats per minute`}
          onChange={(e) => onBpm(Number(e.target.value))}
        />
        <span aria-hidden="true">🐇</span>
      </label>
    </div>
  );
}
```

**Create `src/app/components/HelpPopover.tsx`:**

```tsx
import { useEffect, useRef, useState } from 'react';

export const HELP_LINES: readonly string[] = [
  'Tap a fruit key (or type C–B) to add a note at the blinking line.',
  'Tap a note on the staff to choose it. Then tap a fruit key, or drag it up and down, to change it.',
  '← → move between notes. ↑ ↓ move the chosen note up or down. Shift + ↑ ↓ switches high and low notes.',
  '1–4 pick a note length, “.” adds a dot, R adds a rest, Backspace deletes, Esc lets go of a note.',
  'Space plays your song (from the chosen note) and stops it.',
];

export function HelpPopover() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      className="help"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="secondary help-button"
        aria-label="Help"
        aria-expanded={open}
        aria-controls="editor-help"
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div
          id="editor-help"
          className="help-popover panel"
          role="dialog"
          aria-label="How to use the editor"
        >
          <ul>
            {HELP_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/app/components`
Expected: PASS (7 new tests plus the existing `durationChoices` tests).

- [ ] **Step 5: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
git add src/app/hooks/useToast.ts src/app/components/Toast.tsx src/app/components/Toast.test.tsx \
  src/app/components/PlaybackControls.tsx src/app/components/PlaybackControls.test.tsx \
  src/app/components/HelpPopover.tsx src/app/components/HelpPopover.test.tsx
git commit -m "feat(app): toast, playback controls and help popover components"
```

