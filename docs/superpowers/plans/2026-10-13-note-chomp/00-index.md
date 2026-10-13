# Note Chomp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-only web app that renders simple C-major melodies as large, color-coded "fruit" sheet music with a hungry monster at the start of every staff, editable via a tap editor or ABC/MusicXML import, and exportable as a print-ready vector PDF.

**Architecture:** Pure-TypeScript `core/` (model, music theory, palette, layout engine, editor reducer) produces a geometry-only `LayoutResult`. A single React SVG renderer draws it for screen, and the same SVG markup is converted to vector PDF with jsPDF + svg2pdf.js. Format adapters (`formats/`) convert ABC / MusicXML / our JSON into the `Song` model; persistence sits behind a `SongRepository` interface. Layer boundaries are enforced by ESLint.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict), zod 4, jsPDF 4 + svg2pdf.js 2, fflate (for `.mxl`), Vitest 4 (+ jsdom for XML tests), Playwright 1.64 (e2e), tsx (scripts), ESLint 10 flat config + typescript-eslint 8, Prettier 3.

Spec: `docs/superpowers/specs/2026-10-13-note-chomp-design.md`

## Global Constraints

- Key of C only; accidentals rejected with a friendly, located message.
- Treble clef only (represented by the monster); range **G3–C6 inclusive**.
- Durations: `w | h | q | e`, each optionally dotted; rests for each; time signatures `2/4 | 3/4 | 4/4`; one voice; no ties (bar-crossing notes are errors).
- Legend (single source of truth `src/core/palette/palette.ts`): C red apple · D orange orange · E yellow lemon · F green pear · G turquoise blueberry · A purple grape · B pink raspberry. Solfège Do Re Mi Fa Sol La Ti. Colors follow Chroma-Notes (Boomwhackers) as used by Prodigies.
- Quarter/eighth = solid fruit; half/whole = hollow fruit (thick colored outline, pale tint fill).
- Fruit body fits a 1×1 staff-space box centered on its line/space; decorations never extend vertically beyond ±0.5 staff space.
- `src/core/**` must not import React, DOM APIs, `formats`, `render`, `export`, `persistence`, or `app`. `src/formats/**` may import only `core`. `render` must not import `app`/`persistence`/`export`/`formats`; `export` must not import `app`/`persistence`/`formats`; `persistence` must not import React, `app`, `render`, or `export`. Nothing in `src/` imports `scripts/` or reads `process.env`. All enforced by ESLint (Task 1, with a probe step proving it).
- All external input (imports, localStorage, files) is validated with zod (`validateSong`) at the boundary.
- The APE key lives only in `.env` as `APE_KEY` (gitignored, `chmod 600`). It is **never** imported by anything under `src/`; Vite only exposes `VITE_*` variables (`envPrefix`), and CI fails if `APE_KEY` appears in `dist/`. Never commit `.env`, `ape.key`, or `art-concepts/`.
- Layout units are **millimetres**; y grows downward (SVG convention).
- TypeScript `strict: true`. No `any` in `src/` (use `unknown` + validation).
- Git: this is a plain git repo (not Sapling). Commit with `git add <files> && git commit -m "..."` after each task.
- Run `npm run format` before every commit; `npm run format:check` runs in CI. Plan code blocks are not guaranteed to be Prettier-formatted verbatim — formatting them is expected.
- Browser verification by an agent uses the shared debug Chrome on port 9222 (`curl -fsS --max-time 2 http://127.0.0.1:9222/json/version`; if it fails ask the user to run `! gcdb`). Playwright **test runner** e2e tests use their own headless Chromium — that is fine.
- On this machine the Bash sandbox kills Chromium: run `npx playwright install chromium`, `npm run test:e2e` and `npx playwright test …` with the sandbox disabled for that one command (and only in the project / scratch directory).
- Split long dry runs and long-running agents into small task ranges (e.g. Tasks 1–6, 7–11, …) to avoid request timeouts; wrap shell commands in explicit timeouts and use `vitest run`, never watch mode.

## Deltas from the spec (decided while planning)

1. **Staff size:** the spec already records `RenderOptions.staffSpaceMm` = **Large 6.5 mm** (default, ≈3.5× normal) and **Jumbo 9 mm** (14 mm was rejected there as unable to fit G3–C6 plus labels). The plan does not hard-code "3 / 2 staves per page": systems-per-page is **computed** from the page height and the system height (Large gives 3 per Letter page, Jumbo 2).
2. **Font:** PDF text uses jsPDF's built-in Helvetica (a standard PDF font, renders everywhere) instead of an embedded custom font. On screen the same `Helvetica, Arial, sans-serif` stack is used.
3. **Bundled songs are `.abc` files** (`src/songs/*.abc`) parsed by our own ABC importer at load time. Adding a melody = dropping in an `.abc` file. User songs are still stored as canonical JSON.
4. **Starter songs:** Hot Cross Buns, Mary Had a Little Lamb, Twinkle Twinkle, Ode to Joy, Jingle Bells (chorus), London Bridge, Au Clair de la Lune, Old MacDonald. ("Row Row Row Your Boat" dropped: it is in 6/8.)
5. **Routing:** a ~40-line hash router (`src/app/router.ts`) instead of a routing dependency — works on any static host.
6. **Crash rescue:** the editor autosaves a draft; the error boundary offers to download it.
7. **Layout API names:** the public entry is `layoutSong(song, options): LayoutResult` (pages → systems → items). Item kinds are `staff` (not separate lines), `fruit` with a `size` field (for size-by-duration), and the title is drawn as a `label` item rather than its own kind.
8. **Stem/flag/label color:** stems, flags, beams and note labels use the palette's darker `stroke` shade of the fruit color (not the fill), so yellow/turquoise stay legible on white.
9. **PDF errors:** a failed PDF export shows an inline alert with a **Try again** button (not a toast).
10. **Import is a page** (`#/import`), not a dialog, and also accepts `.xml` files.
11. **Editor backspace:** deleting a note whose removal would break the bar lines leaves a rest of the same length in its place.
12. **Importer leniency:** a short first bar (pickup) is padded with leading rests and a warning; repeat signs are ignored with a warning (repeated sections print once); first/second endings are rejected with a located error.
13. **Dotted eighths are not supported** (editor won't offer them; importers reject them with a located error).

## File Map

```
.github/workflows/ci.yml            CI: format, lint, typecheck, unit, build + key scan, e2e
.env / .env.example                 APE_KEY (env ignored, example committed)
index.html, vite.config.ts, tsconfig.json, eslint.config.js, .prettierrc.json, playwright.config.ts
scripts/ape/
  apeClient.ts (+ .test.ts)         POST /models/v1/images → PNG bytes
  prompts.ts                        concept prompts
  generate-concepts.ts              CLI entry (npm run ape:concepts)
src/
  main.tsx                          bootstrap; wires LocalStorageSongRepository
  core/
    result.ts                       Result<T,E>, ok(), err()
    text.ts                         slugify()
    model/types.ts                  Pitch, Duration, Octave, Note, Rest, MusicEvent, Song
    model/factories.ts              note(), rest(), createEmptySong()
    model/id.ts                     newSongId()
    model/schema.ts                 zod schemas, validateSong()
    theory/pitch.ts                 staffStep, isInRange, stemDirection, ledgerSteps
    theory/rhythm.ts                eventUnits, measureUnits, splitIntoMeasures, unitsToDuration, names
    palette/palette.ts              PALETTE, NEUTRAL, FruitKind
    layout/options.ts               RenderOptions, defaults, paper sizes
    layout/types.ts                 LayoutItem union, SystemLayout, PageLayout, LayoutResult
    layout/metrics.ts               METRICS (staff-space units), page constants
    layout/spacing.ts               eventAdvance, measureWidth, breakIntoSystems
    layout/beams.ts                 findBeamGroups
    layout/system.ts                layoutSystem
    layout/page.ts                  layoutSong (public entry)
    layout/cursor.ts                cursorPosition (editor caret)
    layout/builders.ts              labelItem
    layout/index.ts                 public barrel for other layers
    editor/editorReducer.ts         EditorState, EditorAction, editorReducer, createEditorState
  formats/
    types.ts                        ImportIssue, ImportResult
    issues.ts                       IssueCollector
    finalize.ts                     finalizeImport()
    notechomp/notechomp.ts          serializeSong, parseNoteChompJson
    abc/parseAbc.ts                 parseAbc
    musicxml/parseMusicXml.ts       parseMusicXml (DOMParser)
    musicxml/unzipMxl.ts            extractMusicXmlFromMxl (fflate)
    importSong.ts                   importSong(source) — format detection + fresh id
  render/
    art/fruits.tsx                  FruitArt, FruitGlyph
    art/Monster.tsx                 Monster
    art/glyphs.tsx                  TrebleClef, RestGlyph, FlagGlyph
    svg/items.tsx                   LayoutItemSvg (switch over item kinds), LegendSvg
    svg/PageSvg.tsx                 PageSvg
  export/pdf/exportPdf.ts           createPdf, downloadPdf, pdfFileName
  persistence/
    SongRepository.ts               interface + SongValidationError
    memoryStorage.ts                MemoryStorage (Storage impl)
    LocalStorageSongRepository.ts   versioned, validated, quarantining
    draft.ts                        saveDraft/loadDraft/clearDraft
  songs/*.abc, songs/index.ts       bundled songs → BUNDLED_SONGS
  app/
    App.tsx, router.ts, services.tsx, useSongLibrary.ts, styles.css
    download.ts
    components/ErrorBoundary.tsx, SongPages.tsx, FruitStrip.tsx, FruitKeyboard.tsx, DurationPicker.tsx
    pages/SongbookPage.tsx, EditorPage.tsx, ImportPage.tsx, PrintPage.tsx
    hooks/useEditorKeyboard.ts
e2e/*.spec.ts                       Playwright tests
```

## Phases & Tasks

| File | Tasks |
|---|---|
| [01-foundation.md](01-foundation.md) | 1. Scaffold, tooling, secrets, CI |
| [02-core-model.md](02-core-model.md) | 2. Model types & factories · 3. Pitch theory · 4. Rhythm & measures · 5. Palette · 6. Song validation |
| [03-layout.md](03-layout.md) | 7. Layout contract (options/types/metrics) · 8. Spacing & system breaking · 9. Beam groups · 10. System layout · 11. Page layout |
| [04-render.md](04-render.md) | 12. Fruit art · 13. Monster, clef, rest & flag glyphs · 14. PageSvg renderer |
| [05a-editor-json.md](05a-editor-json.md) | 15. Editor reducer · 16. Import types + NoteChomp JSON |
| [05b-importers.md](05b-importers.md) | 17. ABC import · 18. MusicXML import · 19. importSong |
| [06a-persistence-shell.md](06a-persistence-shell.md) | 20. Persistence · 21. Bundled songs + layout snapshots · 22. App shell, router, services, e2e harness |
| [06b-pages.md](06b-pages.md) | 23. Songbook page · 24. Editor page · 25. Import page |
| [07-print-ape.md](07-print-ape.md) | 26. Print preview & PDF export · 27. APE concept-art script · 28. Visual review & art direction checkpoint |

Tasks are ordered by dependency; execute sequentially. Every task ends with all of `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e` passing (`test:e2e` passes with no specs until Task 22 adds the first ones).
