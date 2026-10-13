# Note Chomp — Design Spec

**Date:** 2026-10-13
**Status:** Approved design, pending implementation plan

## 1. Purpose

Note Chomp is a web app that renders simple melodies as kid-friendly sheet music for **printing**
(no in-browser playback). Each note is drawn as a color-coded fruit; a Pac-Man-like monster sits at
the start of every staff line with its mouth open toward the melody, so as kids play they "feed the
monster the fruit."

### Goals
- Large staff and notes, readable by young children.
- Color coding using the Musical Prodigies legend.
- Correct standard notation underneath the decoration, so skills transfer to real sheet music.
- Easy melody authoring (tap editor) and import of standard formats (ABC, MusicXML).
- Print-ready vector PDF export.

### Non-goals (v1)
- Audio playback, MIDI, or play-along.
- Keys other than C major; accidentals; chords; multiple voices; clefs other than treble.
- User accounts, backend, or cloud sync.

## 2. Musical scope

| Property | Value |
|---|---|
| Key | C major only (white keys); any accidental is rejected with a clear error |
| Clef | Treble (represented by the monster) |
| Range | G3 – C6 inclusive |
| Durations | whole, half, quarter, eighth; each may be dotted; rests for each |
| Time signatures | 2/4, 3/4, 4/4 (bar lines computed, not stored) |
| Voices | One |

Octaves share fruit and color (C4 and C5 are both apples).

### Legend (single source of truth: `core/palette`)

| Note | Solfège | Color | Fruit | Silhouette (grayscale-safe) |
|---|---|---|---|---|
| C | Do | Red | Apple | Round with top dip, stem + leaf |
| D | Re | Orange | Orange | Round, dimpled texture, small leaf |
| E | Mi | Yellow | Lemon | Oval with pointed ends |
| F | Fa | Green | Pear | Teardrop/bell |
| G | Sol | Light blue | Blueberry | Small round with star crown |
| A | La | Purple | Grape bunch | Cluster of circles |
| B | Ti | Pink | Raspberry | Bumpy dome of drupelets (rendered clearly pink, not red) |

Exact hex values are defined once in the palette module and verified against the Prodigies
legend during implementation.

## 3. Architecture

Client-only single-page app: **Vite + React + TypeScript (strict)**. Layers depend inward only;
`core/` has no React or DOM dependencies.

```
src/
  core/
    model/      Song, Note, Rest, Pitch, Duration types + zod schemas/validation
    theory/     pitch → staff step, stem direction, beat math, measure splitting
    palette/    legend table (note → color, fruit, solfège)
    layout/     (Song, RenderOptions) → LayoutTree — pure geometry in staff units
    editor/     pure reducer: (EditorState, Action) → EditorState, with undo/redo
  formats/
    notechomp/  canonical versioned JSON format (read/write)
    abc/        ABC → Song
    musicxml/   MusicXML (.musicxml / .mxl) → Song
  render/
    svg/        LayoutTree → React SVG (Page, System, Staff, Ledger, Stem, Flag, Beam, BarLine…)
    art/        Fruit and Monster SVG components (solid, hollow, scaled variants)
  export/pdf/   LayoutTree pages → vector PDF (jsPDF + svg2pdf.js)
  persistence/  SongRepository interface + LocalStorageSongRepository
  app/          React UI: Songbook, Editor, Import dialog, Print preview
  songs/        bundled starter melodies (*.notechomp.json)
scripts/ape/    dev-only Node script for concept art generation via APE
```

### Data model

```ts
type Pitch = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
type Duration = 'w' | 'h' | 'q' | 'e';
type Note = { kind: 'note'; pitch: Pitch; octave: 3 | 4 | 5 | 6; duration: Duration; dotted?: boolean };
type Rest = { kind: 'rest'; duration: Duration; dotted?: boolean };
type Song = {
  schemaVersion: 1;
  id: string;
  title: string;
  timeSignature: '2/4' | '3/4' | '4/4';
  events: (Note | Rest)[];
};
```

Validation enforces the G3–C6 range (e.g. `C3`, `D6` invalid). Measures are derived from the time
signature; a note that would cross a bar line is a validation error (no ties in v1).

### LayoutTree (the central contract)

`layout(song, options)` returns `Page[] → System[] → Item[]`, where items are positioned primitives
in staff units: `staffLines`, `monster`, `fruit {pitch, octave, x, y, hollow, scale}`, `stem`,
`flag`, `beam`, `ledger`, `barLine`, `rest`, `label`, `legend`, `title`. Both the SVG renderer and
PDF export consume the same tree, so screen and print cannot diverge. Layout is deterministic and
snapshot-tested.

### RenderOptions

| Option | Default |
|---|---|
| `paper` | `'letter'` (`'a4'` available) |
| `sizeByDuration` | `false` (e 0.8×, q 1×, h 1.15×, w 1.3×) |
| `noteLabels` | `'letter'` (`'solfege'`, `'none'`) |
| `showLegend` | `true` |
| `showTrebleClef` | `false` (small real clef beside/inside monster) |
| `showMeasureNumbers` | `false` |

## 4. Visual design

- **Staff:** line spacing ≈ 14 mm; 3 systems per Letter page; thick soft-charcoal lines.
- **Fruit heads:** body is one staff-space tall, centered exactly on its line/space. Decorations
  (leaves, stems, crowns) extend sideways/up and never cover an adjacent staff line.
  - Quarter/eighth: solid colored fruit.
  - Half/whole: hollow fruit — thick colored outline, pale tinted fill.
- **Stems/flags/beams:** standard rules (stem up below middle line, down on/above it), drawn in the
  fruit's color; eighth pairs within a beat are beamed (neutral color when beamed notes differ).
- **Ledger lines:** short brown "twig" strokes, geometrically identical to standard ledger lines.
- **Monster:** replaces the clef at the start of every system, mouth open toward the melody.
- **Spacing:** proportional-lite — horizontal space by duration with a generous minimum so fruit
  never touch. Systems break at bar lines only.
- **Page:** title at top; optional legend strip at bottom showing the 7 fruits with letters.

## 5. Features

### Tap editor
- 8 large fruit buttons (C4–C5) plus octave ▲/▼ to reach G3–C6.
- Duration picker (w/h/q/e + dot), rest button, undo/redo, backspace.
- Insertion cursor: click a note or use arrow keys; keyboard letters C–B enter notes.
- Live staff preview; title and time signature fields.
- Out-of-range or bar-crossing inputs are blocked with an inline message.

### Import
- Paste ABC text or upload `.abc`, `.musicxml`, `.mxl`.
- Returns `{ ok: true, song, warnings[] } | { ok: false, errors[] }`.
- Unsupported content (accidentals, chords, multiple voices, out-of-range, ties) produces specific,
  located, friendly messages (e.g. "Measure 3: F♯ isn't in the key of C").
- Ignorable content (lyrics, dynamics, tempo) is dropped with a warning.

### Songbook & persistence
- Bundled starter songs (6–8: Hot Cross Buns, Mary Had a Little Lamb, Twinkle Twinkle, Ode to Joy,
  Jingle Bells chorus, Row Row Row Your Boat, London Bridge, Au Clair de la Lune) — all within range.
- User songs stored via `SongRepository` (localStorage implementation). Records are versioned and
  zod-validated on load; invalid records are quarantined, not fatal.
- Export/import single songs as `.notechomp.json`.

### Print preview & PDF export
- Preview page renders exactly the pages that will be exported, with RenderOptions controls.
- Export produces a vector PDF (embedded font) named from the song title.

## 6. Art pipeline (hybrid)

1. Move the key from `ape.key` into `.env` as `APE_KEY` (gitignored; `.env.example` committed;
   `ape.key` deleted after migration).
2. `scripts/ape/generate-concepts.ts` calls `POST https://api.wearables-ape.io/models/v1/images`
   to produce monster and fruit style explorations into `art-concepts/` (gitignored by default).
3. Choose a direction; build final fruit and monster as hand-authored SVG React components in
   `render/art/`. If an APE monster render is clearly better than an SVG version, a high-res
   transparent PNG may be used for the monster only.
4. The APE key is never bundled into client code.

## 7. Error handling

- All external input (imports, localStorage, JSON files) passes through zod validation at the
  boundary; core functions assume valid input.
- Parsers report errors with measure/position context; the UI shows them in plain language.
- PDF export failures surface a toast with a retry; they never leave the UI in a broken state.
- A top-level React error boundary shows a friendly fallback and offers to export the current song.

## 8. Testing & tooling

- **Unit (Vitest):** theory, palette, layout geometry, editor reducer, validators, ABC and
  MusicXML parsers (fixtures for supported and rejected input), repository (incl. corrupt data).
- **Snapshot:** LayoutTree for every bundled song under default and toggled options.
- **E2E (Playwright):** tap-edit a song, import ABC, export PDF and assert page count / non-empty.
- **Visual check:** rendered SVG of bundled songs reviewed during development.
- ESLint + Prettier, TypeScript strict, GitHub Actions CI running lint, typecheck, unit, e2e.

## 9. Future (explicitly out of v1)

Playback, accidentals/other keys, ties, lyrics, backend songbook, worksheet image export (PNG/SVG),
alternative monster/fruit themes.
