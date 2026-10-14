# Note Chomp 🍎👾

Kid-friendly, color-coded sheet music you can print. Every note is a fruit (Chroma-Notes / Prodigies colors),
and a hungry monster at the start of each staff eats the melody as kids play it.

| C              | D         | E                 | F               | G                        | A                  | B                |
| -------------- | --------- | ----------------- | --------------- | ------------------------ | ------------------ | ---------------- |
| 🍎 apple (red) | 🍊 orange | 🍋 lemon (yellow) | 🍐 pear (green) | 🫐 blueberry (turquoise) | 🍇 grapes (purple) | raspberry (pink) |
| Do             | Re        | Mi                | Fa              | Sol                      | La                 | Ti               |

Quarter and eighth notes are solid fruit with a tiny smile; half and whole notes are hollow fruit
(pale fill, thick colored outline). Fruit are drawn about 1.3× the size of a normal note head, always
centered on their line or space, in a big staff (Large 6.5 mm or Jumbo 9 mm between lines).

## Play it

Press ▶ Play (or Space) in the editor to hear your song on a piano; the note being played lights up and
the page follows it. The 🐢 … 🐇 slider sets the tempo (60–160 beats per minute). Tap a note on the staff
to choose it, then tap a fruit key, type a letter, or drag it up and down to change it. ← → walk through
the notes, ↑ ↓ move the chosen note, Esc lets go. The "?" button in the editor lists every shortcut.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run test:e2e     # browser tests (Playwright, headless Chromium)
npm run build        # static site in dist/ (works on any static host)
```

## Add a starter melody

Drop an ABC file into `src/songs/` (key of C, 2/4–4/4, notes G3–C6), e.g. `src/songs/my-song.abc`:

```
X:1
T:My Song
M:4/4
L:1/4
K:C
C D E F | G2 G2 |]
```

`npm test` checks that every bundled song imports cleanly, fits on the page without fruit bumping into
each other, and records a layout snapshot.

You can also import songs in the app (Import page): ABC, MusicXML (`.musicxml`, `.xml`, `.mxl`) and
Note Chomp JSON. Songs you make or import are saved in your browser.

## Architecture

- `src/core/` — pure TypeScript: song model + validation, music theory, palette, the layout engine
  (`layoutSong(song, options) → pages of positioned items, in mm`), and the editor reducer.
- `src/formats/` — ABC, MusicXML/.mxl and Note Chomp JSON importers (`importSong`).
- `src/render/` — one SVG renderer (fruit, monster, glyphs) used for both screen and PDF.
- `src/export/pdf/` — vector PDF via jsPDF + svg2pdf.js.
- `src/audio/` — playback behind a `NotePlayer` interface: the Tone.js piano (`ToneNotePlayer`; Tone's
  code is fetched when the editor opens, the piano samples on first use) and a fake used by the tests.
- `src/persistence/` — `SongRepository` interface + validated localStorage implementation.
- `src/app/` — React UI: songbook, tap editor, import, print preview.

Layer rules are enforced by ESLint (`core` imports nothing else; `formats` imports only `core`; `audio`
imports only `core` and Tone.js, and nothing but `audio` and `app` may import Tone.js).

## Concept art with APE (optional, dev only)

Put your key in `.env` (`APE_KEY=...`, see `.env.example`; `.env` is gitignored), then:

```bash
npm run ape:concepts -- --quality low                               # all six concepts (low is the default)
npm run ape:concepts -- --only monster-round-chomper --quality medium   # once a direction is chosen
```

Images land in `art-concepts/` (gitignored). Requests time out after 65 s and transient failures are
retried. The key is never bundled into the web app.

The images are for concept exploration only: they currently come back without real transparency (a
checkerboard is painted into the picture), so the printed art stays hand-made SVG.

## Credits

Piano sound: [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by
Alexander Holm, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The MP3 files in
`public/samples/piano/` are the [Tone.js](https://tonejs.github.io/) project's conversions
(<https://tonejs.github.io/audio/salamander/>), unmodified. Playback uses
[Tone.js](https://github.com/Tonejs/Tone.js) (MIT).
