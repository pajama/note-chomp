# Note Chomp — Editor v2: Playback, Select & Drag, Layout, Quick Fixes

**Date:** 2026-10-13
**Status:** Approved design (user asked to proceed autonomously to a playtestable build)
**Builds on:** `2026-10-13-note-chomp-design.md` (v1, shipped on `main`)
**Inputs:** user feedback after playtesting v1; usability audit `.superpowers/audit/usability-report.md` (local, gitignored)

## 1. Goals

1. **Playback** of songs in the app (new; v1 listed playback as a non-goal — now in scope).
2. **Click selects a note** (instead of placing the cursor after it), and the selected note can be changed.
3. **Drag a selected note up/down** to change its pitch.
4. **Editor layout** that keeps the staff, cursor, and errors on screen.
5. **Quick fixes** from the usability audit (listed in §6).

Out of scope this round: time-signature glyph / beats-left hint, import help & examples, songbook polish (welcome card, undo-delete), print polish (legend first page only, Jumbo page count, sticky print options), toy/synth sound option, monster chomp animation.

## 2. Architecture

Layers keep v1's rules (core is pure; ESLint-enforced boundaries). New pieces:

### 2.1 Core editor state (`src/core/editor/`)

`EditorState` gains `selection: number | null` (index of the selected event) alongside the existing insert `cursor`. Invariant: when `selection !== null` the insert cursor is not shown (UI) and note entry *changes* the selection instead of inserting.

New/changed actions (pure, unit-tested):

| Action | Behavior |
|---|---|
| `select { index }` | Select event `index` (clamped). Clears error. |
| `clearSelection` | Deselect; cursor goes right after the previously selected event. |
| `setCursor { index }` | Place insert cursor at gap `index` (0..events.length) and clear selection. |
| `navigate { delta }` | ←/→ walks the sequence *gap 0, note 0, gap 1, note 1, …, gap N*. From a gap, +1 selects the next note; from a selected note, +1 goes to the gap after it. Clamped. |
| `changeSelectedPitch { pitch, baseOctave }` | Replace the selected event's pitch with `pitch` at `baseOctave + octaveShift` (out of range → friendly error, no change). A selected **rest** becomes a note of the same duration/dot. Commits to history. |
| `nudgeSelected { steps }` | Move the selected note `steps` diatonic steps (±1 = next line/space) via `stepPitch`, clamped to G3–C6 (at the bound: no change, no error). No-op on rests. Commits to history. |
| `dragSelected { steps }` / `endDrag` | During a pointer drag: `dragSelected` sets the pitch to *drag-origin pitch + steps* **without** a history entry; `endDrag` commits one history entry for the whole drag (if the pitch changed). |
| `setDuration`, `toggleDotted` | With a selection: change the selected event's duration/dot (bar-crossing → existing friendly error, no change) **and** set it as the default for new notes. Without selection: v1 behavior. |
| `deleteBackward` | With a selection: delete the selected event (v1 rule: if removal would break bar lines, replace it with a rest of the same length); selection moves to the previous event, or the cursor to gap 0 if none. Without selection: v1 behavior. |
| `insertNote` / `insertRest` | Unchanged; always insert at the cursor (UI routes fruit keys to `changeSelectedPitch` when there is a selection). |

All edits still go through the bar-line check; undo/redo restore `selection` too (snapshot = `{ song, cursor, selection }`).

### 2.2 Core helpers

- `src/core/theory/pitch.ts`: `stepPitch(pitch, octave, delta): { pitch, octave } | undefined` (undefined when the result leaves G3–C6) and `toNoteName(pitch, octave): string` (`'C4'`).
- `src/core/layout/hitTargets.ts`: `editorHitTargets(result: LayoutResult): { notes: NoteTarget[]; gaps: GapTarget[] }` per page — each note target is the full-height column (staff top − 3 spaces … bottom + 4 spaces) spanning the event's slot width; each gap target is a narrow column at slot boundaries plus the empty staff after the last event (gap index = events.length). Pure, tested.
- `src/core/playback/schedule.ts`: `buildSchedule(song, bpm, fromIndex = 0): ScheduledEvent[]` with `{ eventIndex, time (s), duration (s), note: 'C4' | null }` (null for rests); quarter = 60/bpm s; starts at `fromIndex` with time 0. `BPM_RANGE = { min: 60, max: 160, default: 90 }`.

### 2.3 Audio layer (`src/audio/`, new)

```ts
interface NotePlayer {
  load(): Promise<void>;                       // idempotent; first call loads Tone + samples
  play(schedule: ScheduledEvent[], handlers: { onEvent(eventIndex: number): void; onEnd(): void }): Promise<void>;
  stop(): void;
  preview(note: string): void;                 // short (~0.4 s) audition; no-op until loaded, triggers load
}
```

- `ToneNotePlayer`: dynamic `import('tone')` on first use; `Tone.Sampler` with **Salamander Grand Piano** samples bundled at `public/samples/piano/` (A0..C8 subset sufficient for G3–C6 with pitch-shifting, ~8 files: e.g. C3, D#3, F#3, A3, C4, D#4, F#4, A4, C5, D#5, F#5, A5, C6 — choose a set ≤ ~1 MB total), CC-BY 3.0 (attribution in README). `Tone.start()` on the user gesture. Highlight callbacks scheduled with `Tone.getDraw()` / `Transport` so visuals sync with audio.
- `FakeNotePlayer` (tests/e2e): records calls; plays the schedule with real timers so highlight order can be asserted.
- Provided through the existing `Services` context (`services.player`). In e2e the app uses `FakeNotePlayer` when `window.__NOTE_CHOMP_FAKE_AUDIO__ === true` is set before load (via Playwright `addInitScript`) — real Tone otherwise.
- ESLint: `src/audio/**` may import only `core`; nothing outside `src/audio` and `src/app` may import `tone`.

### 2.4 App (`src/app/`)

- `usePlayback(song)` hook: `{ playing, currentEventIndex, bpm, setBpm, play(fromIndex), stop }`; any edit while playing stops playback.
- Editor routes fruit keys / letter keys to `changeSelectedPitch` when there is a selection, else `insertNote`.

## 3. Editor layout & interaction

- **Sticky top bar:** title, time signature, Undo, Redo, Save, Print.
- **Scrolling sheet area:** on screen, render only the systems (no blank page area): a compact "screen" presentation of the same layout pages, width-fitted.
- **Sticky bottom dock:** ▶ Play / ■ Stop, tempo slider (🐢 … 🐇, 60–160, default 90), note lengths (Whole/Half/Quarter/Eighth, Dot, Rest, ⌫), octave ▲/▼ with label, the 8 fruit keys, and a "?" help popover (replaces the long tip line). On narrow/tablet widths the dock stays at the bottom.
- **Auto-scroll:** after any edit, navigation, or playback step, scroll the cursor / selected / playing note into view (`block: 'nearest'`, smooth).
- **Errors:** toast just above the dock (`role="status"`, `aria-live="polite"`), auto-dismiss ~4 s, plus a brief flash on the problem measure. (Replaces the alert above the toolbar.)
- **Selection visuals:** selected fruit gets a glow ring behind it (accent color, not a note color); playing fruit gets a distinct highlight (e.g. warm yellow halo + slight scale); insert cursor as in v1 but only when nothing is selected.
- **Pointer:** pointerdown on a note column selects it (and previews its sound); vertical drag beyond ~4 px enters drag mode: steps = round(−dy / (staffSpace/2)) → `dragSelected`, preview the new pitch on each step change, `endDrag` on pointerup/cancel. Pointer capture + `touch-action: none` on the **selected** note column so touch drags work. Every other column is `pan-y`, so a finger swipe scrolls the sheet. A finger or pen only drags a note that was already selected; on any other note a tap (pointerup) selects it, and a swipe (pointercancel) does nothing. A mouse can press and drag any note at once. Click on a gap target → `setCursor`.
- **Keyboard:** ←/→ `navigate`; ↑/↓ nudge selection (when selected) else octave shift; Shift+↑/↓ always octave shift; Esc `clearSelection`; Space play/stop (when focus isn't in a text field or button); C–B letters change selection or insert; 1–4 durations; `.` dot; R rest (insert at cursor, or turn selection into a rest of the same length); Backspace/Delete delete.
- **Accessibility:** each note target is `role="button"` with `aria-label` like "Note 3: G, quarter note" (+ ", selected"/", playing"); selection changes announced via a polite live region.

## 4. Playback behavior

- Space or ▶ plays from the selected note (if any) else from the start, at the chosen tempo; the current note highlights and the view follows; at the end the highlight clears and the button returns to ▶.
- ■ or Space stops immediately (release all voices).
- Fruit-key taps, selecting a note, and each drag step play a short preview.
- First play/preview shows a brief "Loading piano…" state on the Play button until samples are ready; if loading fails, a toast explains and the app keeps working silently.

## 5. Error handling

- Audio failures (no Web Audio, sample fetch error) never break editing: toast + Play disabled with a tooltip.
- All reducer rejections surface through the toast with the existing friendly messages.

## 6. Quick fixes (from the usability audit)

1. **New song on `#/new`** really starts fresh (after a "Start a new song?" confirm when dirty).
2. **Shortcut focus:** Enter/Esc blur the title input; choosing a time signature returns focus to the editor so letter keys work again.
3. **Draft restore:** opening the editor (new or existing) when a draft for *that song id* (or an unsaved new song) exists offers "Pick up where you left off?" (Restore / Discard). Saving shows a "Saved!" toast.
4. **Imports:** text with no notes fails ("No notes were found…" — v1 already for JSON/MusicXML; ensure ABC garbage text fails too); unrecognized-symbol warnings collapse into one: "Skipped N characters we didn't understand."; the import result clears when the text changes.
5. **Copies:** copying a starter song when "<title> (my copy)" exists names it "(my copy 2)", "(my copy 3)", …

## 7. Testing

- Unit (TDD): reducer selection/navigate/change/nudge/drag/duration/delete/undo with selection; `stepPitch`, `toNoteName`; `buildSchedule`; `editorHitTargets`; key map; ABC garbage/warning collapse; copy naming; `FakeNotePlayer`.
- E2E (Playwright, fake audio): click selects (glow + aria), fruit key changes pitch, length button changes duration, Backspace deletes selection, Esc deselects, ←/→ navigation, ↑/↓ nudge, **mouse drag** up two steps changes E4→G4, Play highlights events in order and Stop clears, Space toggles, staff stays in viewport at 1280×800 while entering 30 notes, each quick fix.
- Manual: real piano audio in the debug Chrome (controller check before handing to the user).
