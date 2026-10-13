# Note Chomp Editor v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let kids and parents hear their songs (piano playback with a following highlight), select a note by clicking it, change it with a fruit key, letter or vertical drag, edit on a layout that keeps the staff and errors on screen, and fix the top usability-audit papercuts.

**Architecture:** New pure pieces in `src/core` (diatonic stepping, playback schedule, editor hit targets, a compact on-screen sheet, selection-aware reducer actions) stay DOM-free and unit-tested. A new `src/audio` layer hides Tone.js behind a `NotePlayer` interface (`ToneNotePlayer` with bundled Salamander piano samples, `FakeNotePlayer` for tests), reached through the existing `Services` context. The editor page is rebuilt as sticky top bar + scrolling compact sheet (`SheetSvg`) + bottom dock, with a `PlaybackController` / `usePlayback` hook, pointer drag (`useNoteDrag`), a selection-aware key map, auto-scroll, a toast, and live-region announcements.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict), zod 4, **Tone.js 15** (new, dynamically imported), jsPDF 4 + svg2pdf.js 2, fflate, Vitest 4 (+ jsdom where needed), Playwright 1.64, ESLint 10 flat config + typescript-eslint 8, Prettier 3.

Spec (binding): `docs/superpowers/specs/2026-10-13-editor-playback-design.md`. v1 plan (conventions this plan follows): `docs/superpowers/plans/2026-10-13-note-chomp/00-index.md`.

## Global Constraints

Carried over from v1 (unchanged):

- Key of C only; treble clef only (the monster); range **G3–C6 inclusive**; durations `w | h | q | e` (optionally dotted, never a dotted eighth); rests for each; time signatures `2/4 | 3/4 | 4/4`; one voice; no ties (bar-crossing notes are errors).
- Legend (single source of truth `src/core/palette/palette.ts`): C red apple · D orange orange · E yellow lemon · F green pear · G turquoise blueberry · A purple grape · B pink raspberry.
- `src/core/**` must not import React, DOM APIs, `formats`, `render`, `export`, `persistence`, `app` (and now `audio`). `src/formats/**` may import only `core`. `render` must not import `app`/`persistence`/`export`/`formats`/`audio`; `export` must not import `app`/`persistence`/`formats`/`audio`; `persistence` must not import React, `app`, `render`, `export`, `audio`. Nothing in `src/` imports `scripts/` or reads `process.env`. All enforced by ESLint.
- All external input (imports, localStorage, files) is validated with zod (`validateSong`) at the boundary.
- Layout units are **millimetres**; y grows downward (SVG convention).
- TypeScript `strict: true`. No `any` in `src/` or `e2e/` (use `unknown` + validation).
- Git: plain git repo (not Sapling). Work on branch `feat/editor-playback`. Commit with `git add <files> && git commit -m "..."` after each task.
- Run `npm run format` before every commit; `npm run format:check` runs in CI. Plan code blocks are Prettier-formatted; if Prettier still changes something, keep Prettier's version.
- Browser verification by an agent uses the shared debug Chrome on port 9222 (`curl -fsS --max-time 2 http://127.0.0.1:9222/json/version`; if it fails ask the user to run `! gcdb`). Playwright **test runner** e2e tests use their own headless Chromium — that is fine.
- On this machine the Bash sandbox kills Chromium: run `npm run test:e2e` and `npx playwright test …` with the sandbox disabled for that one command (and only in the project directory). Port 5179 must be free (`lsof -iTCP:5179 -sTCP:LISTEN` prints nothing) — otherwise Playwright reuses a foreign dev server.
- Wrap shell commands in explicit timeouts and use `vitest run`, never watch mode.

New for v2:

- **Audio layer:** `src/audio/**` may import only `core` and `tone`. Nothing outside `src/audio` and `src/app` may import `tone` (`tone` / `tone/*`). Enforced by ESLint (Task 8, with probe files).
- **Tone is loaded lazily:** only `src/audio/loadTone.ts` imports it, via `await import('tone')`, so it lands in its own chunk and never loads until the first Play/preview.
- **Samples:** Salamander Grand Piano mp3s from `https://tonejs.github.io/audio/salamander/`, bundled in `public/samples/piano/` (11 files F#3…C6, ≤ 1 MB total), CC-BY 3.0 — attribution in `public/samples/piano/ATTRIBUTION.txt` and the README.
- **Tempo:** `BPM_RANGE = { min: 60, max: 160, default: 90 }`; quarter note = 60/bpm s. Preview length `PREVIEW_SECONDS = 0.4`.
- **Selection invariant:** `EditorState.selection: number | null`. When it is non-null the insert cursor is hidden and fruit keys / letters change the selected event instead of inserting. `select` parks `cursor` right after the selected event. Undo/redo snapshots are `{ song, cursor, selection }`.
- **Audio never breaks editing:** a failed load shows a toast and disables Play (with a tooltip); every other control keeps working.
- **E2E always runs with fake audio:** every spec imports `test`/`expect` from `e2e/fixtures.ts`, which sets `window.__NOTE_CHOMP_FAKE_AUDIO__ = true` via `addInitScript`. A test may override it with `'fail-load'`. The fake's call log is `window.__NOTE_CHOMP_AUDIO_LOG__`.
- **Editor messages:** reducer errors, save errors, audio errors and "Saved!" go to the toast (`role="status"`, `aria-live="polite"`, auto-dismiss 4 s). The v1 alert above the toolbar is gone from the editor (Print and Import keep their alerts).
- **On-screen editor sheet** always uses `DEFAULT_RENDER_OPTIONS` (Large staff, letter labels); Print options are unchanged.
- No new runtime dependency other than `tone`.

## Deltas from the spec (decided while planning)

1. **Extra reducer actions:** `restSelected` (R / Rest button with a selection turns it into a rest of the same length — spec §3) and `restore { song }` (draft restore, §6.3). `EditorState` also gains `errorMeasure: number | null` (for the measure flash, §3) and `drag: DragState | null` (drag origin + undo snapshot, §2.1).
2. **`select` sets `cursor = index + 1`.** That makes `clearSelection` ("cursor right after the previously selected event") and `navigate` consistent; `insertNote` with a selection (only reachable from code, the UI routes to `changeSelectedPitch`) inserts after it and drops the selection.
3. **Hit targets:** besides a gap before every event, every system ends with a trailing gap (index = next event), so the end of a line is clickable; gap targets are 0.4 staff spaces wide and never overlap note columns.
4. **`touch-action: none` is set on the note columns, not the whole sheet**, so a touch that starts between notes still scrolls the sheet; drags that start on a note work (pointer capture).
5. **Fake audio switch** accepts `true` or `'fail-load'` (to e2e-test the §4/§5 failure path).
6. **Samples:** F#3, A3, C4, D#4, F#4, A4, C5, D#5, F#5, A5, C6 (≈ 690 KB) — Tone pitch-shifts at most 1.5 semitones.
7. **Draft restore** keeps v1's single draft slot (`notechomp:draft:v1`). Rules (`draftToOffer`): on `#/new`, offer a non-empty draft whose id is not a saved song; on a saved song, offer its own draft if it differs; never on a fresh starter copy. Editing without answering dismisses the offer. The editor now waits for the song library before showing `#/new` too.
8. **ABC "not music" rule:** if any characters were skipped and either the text has no `K:` field or more characters were skipped than notes were read, the import fails with "No notes were found. Is this ABC, MusicXML or a Note Chomp file?".
9. **Space** toggles playback unless focus is in a text field, select, button or link (those keep their native Space).
10. While a note is selected the length buttons show **its** length and dot.

## File Map

```
eslint.config.js                       + audio layer, tone restrictions
package.json / package-lock.json       + tone
public/samples/piano/*.mp3             Salamander samples (11) + ATTRIBUTION.txt
README.md                              playback section + sample attribution
src/core/
  theory/pitch.ts                      + fromDiatonicIndex, stepPitch, clampedStepPitch, toNoteName
  playback/schedule.ts                 NEW buildSchedule, scheduleEnd, clampBpm, BPM_RANGE, ScheduledEvent
  layout/hitTargets.ts                 NEW editorHitTargets, measureBox, systemStaff (+ target types)
  layout/compact.ts                    NEW compactSheet (systems stacked for the screen)
  layout/index.ts                      + exports for the two files above
  editor/editorReducer.ts              selection, navigate, change/nudge/drag, length/dot/delete with selection, restore
  editor/describe.ts                   NEW describeEvent (aria labels)
  text.ts                              + copyTitle
src/formats/abc/parseAbc.ts            not-music failure, collapsed "Skipped N characters" warning
src/audio/                             NEW layer
  NotePlayer.ts                        NotePlayer, PlaybackHandlers, PREVIEW_SECONDS
  FakeNotePlayer.ts                    test double with real timers + call log
  toneLike.ts                          ToneLike / SamplerLike (the Tone slice we use)
  loadTone.ts                          dynamic import('tone') → ToneLike
  ToneNotePlayer.ts                    Sampler + Transport + Draw
src/render/svg/SheetSvg.tsx            NEW compact editor sheet: glow, halo, flash, cursor, note/gap targets
src/app/
  audio.ts                             NEW createNotePlayer (fake-audio switch)
  services.tsx                         + player
  playback/PlaybackController.ts       NEW playback state machine
  hooks/usePlayback.ts                 NEW
  hooks/useToast.ts                    NEW
  hooks/useNoteDrag.ts                 NEW pointer select + drag (dragSteps, staffSpacePx)
  hooks/useEditorKeyboard.ts           keyToCommand (selection-aware), Space, Esc, Delete
  editorFocus.ts                       NEW scrollAnchorSelector, selectionAnnouncement
  draftOffer.ts                        NEW draftToOffer
  components/Toast.tsx                 NEW
  components/PlaybackControls.tsx      NEW Play/Stop + tempo
  components/HelpPopover.tsx           NEW "?" popover (replaces the tip line)
  components/EditorSheet.tsx           NEW scrolling sheet wrapper (layout memo, auto-scroll)
  pages/EditorPage.tsx                 rebuilt layout + wiring
  pages/SongbookPage.tsx               copyTitle
  pages/ImportPage.tsx                 result clears on text change
  router.ts                            LeaveReason, confirmLeave
  App.tsx                              editor-mode layout class, New song on #/new
  styles.css                           editor v2 layout
src/main.tsx                           player: createNotePlayer(window)
e2e/fixtures.ts                        NEW fake-audio test fixture + helpers
e2e/selection.spec.ts, playback.spec.ts, layout.spec.ts, quickfixes.spec.ts   NEW
e2e/*.spec.ts (v1)                     import from ./fixtures; alert → toast
```

## Phases & Tasks

| File | Tasks |
|---|---|
| [01a-core-pitch-schedule.md](01a-core-pitch-schedule.md) | 1. Pitch stepping & note names · 2. Playback schedule |
| [01b-core-layout-targets.md](01b-core-layout-targets.md) | 3. Editor hit targets & measure boxes · 4. Compact on-screen sheet |
| [02a-reducer-selection.md](02a-reducer-selection.md) | 5. Reducer: selection & navigation |
| [02b-reducer-pitch-drag.md](02b-reducer-pitch-drag.md) | 6. Reducer: change, nudge & drag the selected note |
| [02c-reducer-length-delete.md](02c-reducer-length-delete.md) | 7. Reducer: length, dot, delete & rest with a selection; restore |
| [03a-audio-player.md](03a-audio-player.md) | 8. NotePlayer, FakeNotePlayer & audio layer rules |
| [03b-audio-tone.md](03b-audio-tone.md) | 9. ToneNotePlayer with bundled piano samples |
| [04a-app-player-playback.md](04a-app-player-playback.md) | 10. Player service, fake-audio switch & e2e fixture · 11. PlaybackController & usePlayback |
| [04b-app-components.md](04b-app-components.md) | 12. Toast, playback controls & help popover |
| [04c-render-sheet.md](04c-render-sheet.md) | 13. SheetSvg & note descriptions |
| [05-editor-layout.md](05-editor-layout.md) | 14. Editor layout v2: top bar, scrolling sheet, dock, toast, click-to-select |
| [06a-interaction-play-drag.md](06a-interaction-play-drag.md) | 15. Playback in the editor · 16. Pointer select & drag |
| [06b-interaction-keys-scroll.md](06b-interaction-keys-scroll.md) | 17. Selection-aware keyboard · 18. Auto-scroll & announcements |
| [07a-quick-fixes-editor.md](07a-quick-fixes-editor.md) | 19. New song on #/new & shortcut focus · 20. Draft restore & "Saved!" |
| [07b-quick-fixes-import-copies.md](07b-quick-fixes-import-copies.md) | 21. Import fixes · 22. Numbered copies |
| [08-e2e-docs.md](08-e2e-docs.md) | 23. E2E: selection & drag · 24. E2E: playback · 25. E2E: layout & quick fixes · 26. README, final verification & real-audio check |

Tasks are ordered by dependency; execute sequentially. Every task ends with all of `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test` passing, and — from Task 10 on — `npm run test:e2e` too (sandbox disabled for that command).

## Spec coverage

| Spec | Tasks |
|---|---|
| §1.1 / §4 playback (Play/Stop, tempo, highlight, follow, previews, loading state, failure) | 2, 8, 9, 10, 11, 12, 15, 17 (Space), 18 (follow), 24 |
| §1.2 / §2.1 click selects, change the selection | 5, 6, 7, 13, 14, 16, 17, 23 |
| §1.3 drag up/down | 6, 16, 23 |
| §1.4 / §3 layout, toast, flash, glow/halo, help, auto-scroll, a11y | 3, 4, 12, 13, 14, 18, 25 |
| §2.2 core helpers | 1, 2, 3 |
| §2.3 audio layer + ESLint | 8, 9, 10 |
| §2.4 usePlayback, fruit-key routing | 11, 14, 15 |
| §5 error handling | 11, 12, 14, 15, 24 |
| §6.1 New song on #/new | 19, 25 |
| §6.2 shortcut focus | 19, 25 |
| §6.3 draft restore, "Saved!" | 7, 20, 25 |
| §6.4 imports | 21, 25 |
| §6.5 numbered copies | 22, 25 |
| §7 tests (unit, e2e, manual) | every task; 23–26 |
