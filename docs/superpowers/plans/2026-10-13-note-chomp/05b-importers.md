# Phase 5b — ABC and MusicXML importers

Importers are **strict about music, lenient about decoration**. Anything that would change which notes kids play (accidentals, chords, ties, tuplets, extra voices, out-of-range notes, unsupported lengths/meters/keys) is an **error** with a located, plain-language message. Things that don't affect the notes (lyrics, dynamics, slurs, chord symbols, plain repeat signs, grace notes) are dropped with a **warning**. First/second endings are an error (the printed order of the notes would be wrong). A short first bar is treated as a pickup: rests are added in front so every bar line lands where it should, with a warning.

### Task 17: ABC import

**Files:**
- Create: `src/formats/importHelpers.ts`, `src/formats/abc/parseAbc.ts`
- Test: `src/formats/importHelpers.test.ts`, `src/formats/abc/parseAbc.test.ts`

**Interfaces:**
- Consumes: `IssueCollector`, `finalizeImport`, `ImportResult` (Task 16); `isInRange`, `diatonicIndex`, `RANGE_LABEL` (Task 3); `measureUnits`, `unitsToDuration`, `eventUnits`, `formatBeats` (Task 4); `note`, `rest` factories and types (Task 2)
- Produces:
  - `parseAbc(text: string): ImportResult` (song id is the placeholder `'imported'`; `importSong` replaces it)
  - `src/formats/importHelpers.ts` (shared with Task 18): `PICKUP_WARNING`, `REPEATS_WARNING`, `endingsError(m)`, `timeChangeError(m)`, `rangeError(m, pitch, octave)`, `lengthError(m, pitch | 'rest')`, `dottedEighthError(m, 'note' | 'rest')`, `fillRests(units: number): Rest[] | undefined`

Supported ABC subset: header fields `X T M L K V W w Q` (others ignored); `M:` 2/4, 3/4, 4/4, `C`; `L:1/N`; default length 1/8 (1/16 if the meter is under 3/4); `K:` any white-key key — C major / A minor and the white-key modes (`Ddor Ephr Flyd Gmix Bloc`), compared on the tonic plus the first three letters of the mode, with `clef=`-style options ignored; notes `A–G a–g` with `,` / `'` octave marks; lengths `2`, `/2`, `/`, `3/2`, `//`; broken rhythm `>` / `<` (`A>B` = A×1½ then B×½); rests `z x`, measure rests `Z X`; bar lines `| || |] [| :| |: ::` (repeat signs are dropped with a warning). `K: M: L: V:` inside the tune — inline `[M:3/4]` or a field line after `K:` — use the same rules as the header; a different `M:` is an error, because a song has one meter. Endings (`[1 |1 :|2`) and `>>` / `<<` (they need sixteenths) are errors. Each source bar is counted: a short first bar is padded as a pickup; any other bar except the last that isn't exactly one measure long is an error.

- [ ] **Step 1: Write the failing tests**

`src/formats/abc/parseAbc.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { note, rest } from '../../core/model/factories';
import { eventUnits } from '../../core/theory/rhythm';
import { parseAbc } from './parseAbc';

const tune = (body: string, header = 'X:1\nT:Test Tune\nM:4/4\nL:1/4\nK:C') => `${header}\n${body}\n`;

function expectOk(text: string) {
  const result = parseAbc(text);
  if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));
  return result;
}

function expectErrors(text: string) {
  const result = parseAbc(text);
  if (result.ok) throw new Error('expected failure');
  return result.errors.map((e) => e.message);
}

const units = (events: { duration: 'w' | 'h' | 'q' | 'e'; dotted?: boolean }[]) =>
  events.reduce((sum, e) => sum + eventUnits(e), 0);

describe('parseAbc', () => {
  it('parses Hot Cross Buns', () => {
    const { song, warnings } = expectOk(tune('E D C2 | E D C2 | C/2C/2C/2C/2 D/2D/2D/2D/2 | E D C2 |]'));
    expect(song.title).toBe('Test Tune');
    expect(song.timeSignature).toBe('4/4');
    expect(song.events).toHaveLength(17);
    expect(song.events.slice(0, 3)).toEqual([note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h')]);
    expect(song.events[6]).toEqual(note('C', 4, 'e'));
    expect(warnings).toEqual([]);
  });

  it('uses 1/8 as the default length in 4/4 and 1/16 in 2/4', () => {
    expect(expectOk(tune('CDEF GABc |', 'X:1\nT:t\nM:4/4\nK:C')).song.events[0]).toEqual(note('C', 4, 'e'));
    expect(expectOk(tune('C2D2 E4 |', 'X:1\nT:t\nM:2/4\nK:C')).song.events[0]).toEqual(note('C', 4, 'e'));
  });

  it('handles octave marks across G3–C6', () => {
    const { song } = expectOk(tune("G, A, B, C | c' z3 |"));
    expect(song.events.slice(0, 5)).toEqual([
      note('G', 3, 'q'), note('A', 3, 'q'), note('B', 3, 'q'), note('C', 4, 'q'), note('C', 6, 'q'),
    ]);
  });

  it('parses dotted lengths and rests', () => {
    const { song } = expectOk(tune('C3/2 D/2 z2 | Z |'));
    expect(song.events).toEqual([note('C', 4, 'q', true), note('D', 4, 'e'), rest('h'), rest('w')]);
  });

  it('parses broken rhythms: A>B is dotted-long then short, A<B the reverse', () => {
    const { song } = expectOk(tune('C>D E2 |'));
    expect(song.events).toEqual([note('C', 4, 'q', true), note('D', 4, 'e'), note('E', 4, 'h')]);
    expect(units(song.events)).toBe(16);
    const reversed = expectOk(tune('C<D E2 | z>G A2 |')).song.events;
    expect(reversed).toEqual([
      note('C', 4, 'e'), note('D', 4, 'q', true), note('E', 4, 'h'),
      rest('q', true), note('G', 4, 'e'), note('A', 4, 'h'),
    ]);
    expect(units(reversed.slice(0, 3))).toBe(16);
    expect(units(reversed.slice(3))).toBe(16);
  });

  it('reports double broken rhythms, which need sixteenths', () => {
    expect(expectErrors(tune('C>>D E2 |'))).toEqual([
      "Measure 1: >> rhythms need sixteenth notes, which Note Chomp can't show yet.",
    ]);
  });

  it('reports dotted eighths', () => {
    expect(expectErrors(tune('C3/2 D/2 E2 F4 |', 'X:1\nT:t\nM:4/4\nL:1/8\nK:C'))[0]).toBe(
      "Measure 1: dotted eighth notes aren't supported yet.",
    );
    expect(expectErrors(tune('C>D E2 F4 |', 'X:1\nT:t\nM:4/4\nL:1/8\nK:C'))[0]).toBe(
      "Measure 1: dotted eighth notes aren't supported yet.",
    );
  });

  it('accepts M:C and the white-key keys', () => {
    expect(expectOk(tune('C4 |', 'X:1\nT:t\nM:C\nL:1/4\nK:Am')).song.timeSignature).toBe('4/4');
    for (const key of ['A minor', 'C Major', 'D dorian', 'Cmaj', 'Amin', 'C clef=treble']) {
      expect(parseAbc(tune('C4 |', `X:1\nT:t\nM:4/4\nL:1/4\nK:${key}`)).ok).toBe(true);
    }
  });

  it('rejects other keys', () => {
    for (const key of ['G', 'Bb', 'Cm', 'none']) {
      expect(expectErrors(tune('C4 |', `X:1\nT:t\nM:4/4\nL:1/4\nK:${key}`))).toEqual([
        `This tune is in the key of ${key}. Only the key of C is supported for now.`,
      ]);
    }
  });

  it('defaults the title', () => {
    expect(expectOk(tune('C4 |', 'X:1\nM:4/4\nL:1/4\nK:C')).song.title).toBe('Untitled Song');
  });

  it('reports sharps and flats with the measure number', () => {
    expect(expectErrors(tune('C D E F | ^F G A B |'))).toEqual([
      "Measure 2: F♯ isn't in the key of C. Only white keys are supported for now.",
    ]);
    expect(expectErrors(tune('_B4 |'))[0]).toBe("Measure 1: B♭ isn't in the key of C. Only white keys are supported for now.");
  });

  it('reports out-of-range notes in plain words', () => {
    expect(expectErrors(tune('C, D E F |'))).toEqual([
      "Measure 1: a C that low is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
    ]);
    expect(expectErrors(tune("C D E F | d' c b a |"))).toEqual([
      "Measure 2: a D that high is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
    ]);
  });

  it('reports chords, ties and tuplets', () => {
    expect(expectErrors(tune('[CEG] D E F |'))).toEqual(["Measure 1: chords (several notes at once) aren't supported."]);
    expect(expectErrors(tune('C2- C2 |'))).toEqual(["Measure 1: tied notes aren't supported yet."]);
    expect(expectErrors(tune('(3CDE C |'))).toEqual(["Measure 1: triplets and other tuplets aren't supported."]);
  });

  it('reports unsupported lengths, meters, keys and voices', () => {
    expect(expectErrors(tune('C/4 |'))[0]).toBe(
      "Measure 1: one C has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).",
    );
    expect(expectErrors(tune('C3 |', 'X:1\nT:t\nM:6/8\nL:1/8\nK:C'))).toContain(
      "The time signature 6/8 isn't supported yet — use 2/4, 3/4 or 4/4.",
    );
    expect(expectErrors(tune('G4 |', 'X:1\nT:t\nM:4/4\nL:1/4\nK:G'))).toEqual([
      'This tune is in the key of G. Only the key of C is supported for now.',
    ]);
    expect(expectErrors('X:1\nT:t\nM:4/4\nL:1/4\nK:C\nV:1\nC4|\nV:2\nE4|\n')).toContain(
      'This tune has more than one voice (V:). Only single-melody tunes are supported.',
    );
  });

  it('applies inline and mid-tune K:, M: and L: fields', () => {
    expect(expectOk(tune('C4 | [L:1/8] CDEF GABc |')).song.events[1]).toEqual(note('C', 4, 'e'));
    expect(expectOk(tune('C4 | [M:4/4] D4 |')).song.events).toEqual([note('C', 4, 'w'), note('D', 4, 'w')]);
    expect(expectErrors(tune('C4 | [M:3/4] D3 |'))).toEqual(["Measure 2: time signature changes aren't supported."]);
    expect(expectErrors(tune('C4 |\nM:2/4\nD2 |'))).toEqual(["Measure 2: time signature changes aren't supported."]);
    expect(expectErrors(tune('C4 | [K:G] D4 |'))).toEqual([
      'This tune is in the key of G. Only the key of C is supported for now.',
    ]);
    expect(expectOk(tune('C4 | [K:Am] D4 |')).song.events).toHaveLength(2);
    expect(expectOk(tune('[P:A] C4 |')).warnings.map((w) => w.message)).toEqual(['Inline fields (like [P:A]) were ignored.']);
  });

  it('reports bar-crossing notes from validation', () => {
    expect(expectErrors(tune('C3 D2 |'))[0]).toMatch(/^Measure 1: the half note doesn't fit/);
  });

  it('pads a pickup bar with rests so the bar lines line up', () => {
    const { song, warnings } = expectOk(tune('G | c2 e | d2 |', 'X:1\nT:t\nM:3/4\nL:1/4\nK:C'));
    expect(song.events).toEqual([
      rest('h'), note('G', 4, 'q'), note('C', 5, 'h'), note('E', 5, 'q'), note('D', 5, 'h'),
    ]);
    expect(units(song.events.slice(0, 2))).toBe(12);
    expect(units(song.events.slice(2, 4))).toBe(12);
    expect(warnings.map((w) => w.message)).toEqual([
      'The tune starts with a pickup — rests were added at the start so the bar lines line up.',
    ]);
    const eighthPickup = expectOk(tune('G/2 | C4 | D4 |')).song.events;
    expect(eighthPickup.slice(0, 3)).toEqual([rest('h', true), rest('e'), note('G', 4, 'e')]);
    expect(units(eighthPickup.slice(0, 3))).toBe(16);
  });

  it('reports a wrong-length bar in the middle of the tune', () => {
    expect(expectErrors(tune('C4 | D3 | E4 |'))).toEqual(['Measure 2: this measure has 3 beats but 4/4 needs 4 beats.']);
    expect(expectErrors(tune('C4 | D2 E3/2 | E4 |'))).toEqual([
      'Measure 2: this measure has 3½ beats but 4/4 needs 4 beats.',
    ]);
    expect(expectErrors(tune('C4 D | E4 |'))).toEqual(['Measure 1: this measure has 5 beats but 4/4 needs 4 beats.']);
  });

  it('warns about repeat signs and ignored decoration', () => {
    const { warnings } = expectOk(
      'X:1\nT:t\nM:4/4\nL:1/4\nK:C\n|: "C"C !p!D (EF) :|\nw: one two three four\n%% a comment\n',
    );
    // Field warnings (lyrics) come first: the header/field pass runs before the body is tokenized.
    expect(warnings.map((w) => w.message)).toEqual([
      'Lyrics were ignored.',
      'Repeat signs were ignored — the music is printed once, straight through.',
      'Chord symbols and text annotations were ignored.',
      'Decorations (like accents or dynamics) were ignored.',
      'Slurs were ignored.',
    ]);
  });

  it('reports first and second endings', () => {
    const message = (m: number) => `Measure ${m}: first and second endings aren't supported yet — write the tune out in full.`;
    expect(expectErrors(tune('|: C4 |1 D4 :|2 E4 |]'))).toEqual([message(2), message(3)]);
    expect(expectErrors(tune('|: C4 | [1 D4 :| [2 E4 |]'))).toEqual([message(2), message(3)]);
  });

  it('imports only the first tune of a multi-tune file', () => {
    const { song, warnings } = expectOk(`${tune('C4 |')}\nX:2\nT:Second\nK:C\nD4|\n`);
    expect(song.title).toBe('Test Tune');
    expect(song.events).toEqual([note('C', 4, 'w')]);
    expect(warnings.map((w) => w.message)).toContain('This file has several tunes — only the first one was imported.');
  });
});
```

`src/formats/importHelpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rest } from '../core/model/factories';
import { fillRests, lengthError, rangeError } from './importHelpers';

describe('fillRests', () => {
  it('uses the fewest rests, largest first', () => {
    expect(fillRests(12)).toEqual([rest('h', true)]);
    expect(fillRests(8)).toEqual([rest('h')]);
    expect(fillRests(14)).toEqual([rest('h', true), rest('e')]);
    expect(fillRests(10)).toEqual([rest('h'), rest('e')]);
    expect(fillRests(0)).toEqual([]);
  });

  it('gives up on lengths no rest can make', () => {
    expect(fillRests(3)).toBeUndefined();
    expect(fillRests(1.5)).toBeUndefined();
  });
});

describe('importer messages', () => {
  it('describes out-of-range notes in plain words', () => {
    expect(rangeError(2, 'C', 3)).toBe(
      "Measure 2: a C that low is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
    );
    expect(rangeError(1, 'F', 3)).toMatch(/^Measure 1: an F that low /);
    expect(rangeError(4, 'D', 6)).toMatch(/^Measure 4: a D that high /);
  });

  it('describes unsupported lengths in plain words', () => {
    expect(lengthError(1, 'C')).toBe(
      "Measure 1: one C has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).",
    );
    expect(lengthError(3, 'rest')).toMatch(/^Measure 3: one rest has a length/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/formats/abc src/formats/importHelpers.test.ts`
Expected: FAIL — cannot resolve `./parseAbc` and `./importHelpers`.

- [ ] **Step 3: Implement**

`src/formats/importHelpers.ts` (messages and pickup padding shared with the MusicXML importer):

```ts
import { rest } from '../core/model/factories';
import type { Pitch, Rest } from '../core/model/types';
import { diatonicIndex, RANGE_LABEL } from '../core/theory/pitch';

/** Messages and helpers shared by the ABC and MusicXML importers. */

export const PICKUP_WARNING = 'The tune starts with a pickup — rests were added at the start so the bar lines line up.';
export const REPEATS_WARNING = 'Repeat signs were ignored — the music is printed once, straight through.';

export const endingsError = (m: number) =>
  `Measure ${m}: first and second endings aren't supported yet — write the tune out in full.`;

export const timeChangeError = (m: number) => `Measure ${m}: time signature changes aren't supported.`;

/** "an A", "an E", "an F" (said "eff"), otherwise "a". */
const withArticle = (pitch: Pitch) => `${'AEF'.includes(pitch) ? 'an' : 'a'} ${pitch}`;

export const rangeError = (m: number, pitch: Pitch, octave: number) =>
  `Measure ${m}: ${withArticle(pitch)} that ${diatonicIndex(pitch, octave) < diatonicIndex('G', 3) ? 'low' : 'high'} ` +
  `is outside Note Chomp's range (the G below middle C up to high C, ${RANGE_LABEL}).`;

export const lengthError = (m: number, what: Pitch | 'rest') =>
  `Measure ${m}: one ${what} has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).`;

export const dottedEighthError = (m: number, kind: 'note' | 'rest') =>
  `Measure ${m}: dotted eighth ${kind}s aren't supported yet.`;

const REST_CHUNKS: [number, Rest][] = [
  [16, rest('w')], [12, rest('h', true)], [8, rest('h')], [6, rest('q', true)], [4, rest('q')], [2, rest('e')],
];

/** The fewest rests (largest first) that add up to `units`, or undefined if that can't be done. */
export function fillRests(units: number): Rest[] | undefined {
  const rests: Rest[] = [];
  let left = units;
  for (const [chunk, r] of REST_CHUNKS) {
    while (left >= chunk) {
      rests.push({ ...r });
      left -= chunk;
    }
  }
  return left === 0 ? rests : undefined;
}
```

`src/formats/abc/parseAbc.ts`:

```ts
import { note, rest } from '../../core/model/factories';
import { TIME_SIGNATURES, type MusicEvent, type Octave, type Pitch, type TimeSignature } from '../../core/model/types';
import { isInRange } from '../../core/theory/pitch';
import { formatBeats, measureUnits, unitsToDuration } from '../../core/theory/rhythm';
import { finalizeImport } from '../finalize';
import {
  dottedEighthError, endingsError, fillRests, lengthError, PICKUP_WARNING, rangeError, REPEATS_WARNING, timeChangeError,
} from '../importHelpers';
import { IssueCollector } from '../issues';
import type { ImportResult } from '../types';

/** Letter + first three letters of the mode ('' = major, 'm' = minor). Every one of these uses only white keys. */
const SUPPORTED_KEYS = new Set([
  'C', 'Cmaj', 'Cma', 'Cion', 'Cio', 'Am', 'Amin', 'Ami', 'Aaeo', 'Aae', 'Ddor', 'Ephr', 'Flyd', 'Gmix', 'Bloc',
]);
/** `C:|` is music (note C + repeat), not a field — hence the lookahead. */
const FIELD = /^([A-Za-z]):(?![|:])\s*(.*)$/;
/** Fields that change the music. After the header they are treated like inline fields (`[M:3/4]`). */
const MUSIC_FIELDS = new Set(['K', 'M', 'L', 'V']);
const DECORATION_CHARS = new Set(['.', '~', 'H', 'L', 'M', 'O', 'P', 'S', 'T', 'u', 'v']);

const MSG = {
  annotations: 'Chord symbols and text annotations were ignored.',
  decorations: 'Decorations (like accents or dynamics) were ignored.',
  slurs: 'Slurs were ignored.',
  grace: 'Grace notes were ignored.',
  inline: 'Inline fields (like [P:A]) were ignored.',
  lyrics: 'Lyrics were ignored.',
  tempo: 'The tempo marking was ignored.',
  manyTunes: 'This file has several tunes — only the first one was imported.',
  voices: 'This tune has more than one voice (V:). Only single-melody tunes are supported.',
};

interface Header {
  title?: string;
  meter: TimeSignature;
  unitUnits?: number;
  voices: Set<string>;
}

function stripComment(line: string): string {
  const index = line.indexOf('%');
  return index === -1 ? line : line.slice(0, index);
}

function isSupportedKey(value: string): boolean {
  // Drop `clef=treble`-style options; what is left must be a tonic plus an optional mode.
  const key = value.replace(/\b[A-Za-z-]+=\S*/g, '').trim();
  if (!key) return true;
  const match = /^([A-G])\s*([A-Za-z]*)$/.exec(key);
  if (!match) return false;
  const [, letter, mode] = match;
  return SUPPORTED_KEYS.has(letter.toUpperCase() + mode.slice(0, 3).toLowerCase());
}

/** `measure` is set for fields that appear mid-tune (inline `[M:3/4]` or a field line after `K:`). */
function readField(name: string, value: string, header: Header, issues: IssueCollector, measure?: number): void {
  switch (name) {
    case 'T':
      header.title ??= value;
      return;
    case 'M': {
      const meter = value === 'C' ? '4/4' : value;
      if (!(TIME_SIGNATURES as readonly string[]).includes(meter)) {
        issues.error(`The time signature ${value} isn't supported yet — use 2/4, 3/4 or 4/4.`);
      } else if (measure !== undefined && meter !== header.meter) {
        issues.error(timeChangeError(measure));
      } else {
        header.meter = meter as TimeSignature;
      }
      return;
    }
    case 'L': {
      const match = /^1\/(1|2|4|8|16)$/.exec(value);
      if (match) header.unitUnits = 16 / Number(match[1]);
      else issues.error(`The default note length L:${value} isn't supported — use L:1/4 or L:1/8.`);
      return;
    }
    case 'K':
      if (!isSupportedKey(value)) issues.error(`This tune is in the key of ${value}. Only the key of C is supported for now.`);
      return;
    case 'V':
      header.voices.add(value.split(/\s+/)[0] ?? '');
      if (header.voices.size > 1) issues.error(MSG.voices);
      return;
    case 'W':
    case 'w':
      issues.warn(MSG.lyrics);
      return;
    case 'Q':
      issues.warn(MSG.tempo);
      return;
    default:
      return;
  }
}

export function parseAbc(text: string): ImportResult {
  const issues = new IssueCollector();
  const header: Header = { meter: '4/4', voices: new Set() };
  const body: string[] = [];
  let seenTune = false;
  let inBody = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = stripComment(raw).trim();
    if (!line) continue;
    const field = FIELD.exec(line);
    if (field) {
      const [, name, value] = field;
      if (name === 'X') {
        if (seenTune) {
          issues.warn(MSG.manyTunes);
          break;
        }
        seenTune = true;
        continue;
      }
      if (inBody && MUSIC_FIELDS.has(name)) {
        body.push(`[${name}:${value.trim()}]`);
        continue;
      }
      readField(name, value.trim(), header, issues);
      if (name === 'K') inBody = true;
      continue;
    }
    inBody = true;
    body.push(line);
  }

  const events = tokenizeBody(body.join(' '), header, issues);

  return finalizeImport(
    { schemaVersion: 1, id: 'imported', title: header.title || 'Untitled Song', timeSignature: header.meter, events },
    issues,
  );
}

/** One bar as written in the source, between two bar lines. */
interface SourceBar {
  measure: number;
  units: number;
  /** How many measures it stands for (`Z3` is three). */
  span: number;
  /** Contains something whose length we couldn't count (a chord or tuplet) — already an error. */
  unknown: boolean;
}

function tokenizeBody(src: string, header: Header, issues: IssueCollector): MusicEvent[] {
  const meter = header.meter;
  const full = measureUnits(meter);
  const events: MusicEvent[] = [];
  const bars: SourceBar[] = [];
  let i = 0;
  let measure = 1;
  let eventsInMeasure = 0;
  let barUnits = 0;
  let barSpan = 1;
  let barUnknown = false;
  /** Set by `>` / `<`: the length multiplier for the next note or rest. */
  let pendingFactor = 1;

  const unit = () => header.unitUnits ?? (full >= 12 ? 2 : 1);
  const peek = (offset = 0) => src[i + offset] ?? '';
  const isDigit = (c: string) => c >= '0' && c <= '9';
  const skipPast = (close: string) => {
    const end = src.indexOf(close, i + 1);
    i = end === -1 ? src.length : end + 1;
  };
  const endBar = () => {
    if (eventsInMeasure === 0) return;
    bars.push({ measure, units: barUnits, span: barSpan, unknown: barUnknown });
    measure += barSpan;
    eventsInMeasure = 0;
    barUnits = 0;
    barSpan = 1;
    barUnknown = false;
  };
  const readLength = (): number => {
    let num = '';
    while (isDigit(peek())) num += src[i++];
    let slashes = 0;
    while (peek() === '/') {
      slashes++;
      i++;
    }
    let den = '';
    while (isDigit(peek())) den += src[i++];
    const n = num ? Number(num) : 1;
    const d = slashes === 0 ? 1 : den ? Number(den) * 2 ** (slashes - 1) : 2 ** slashes;
    return (unit() * n) / d;
  };
  /** A note or rest length, including broken rhythm: `A>B` = A×1.5 then B×½, `A<B` the reverse. */
  const readTimedLength = (): number => {
    let units = readLength() * pendingFactor;
    pendingFactor = 1;
    let j = i;
    while (/\s/.test(src[j] ?? '')) j++;
    const sign = src[j];
    if (sign === '>' || sign === '<') {
      let count = 0;
      while (src[j] === sign) {
        count++;
        j++;
      }
      i = j;
      if (count > 1) {
        issues.error(`Measure ${measure}: ${sign}${sign} rhythms need sixteenth notes, which Note Chomp can't show yet.`);
        barUnknown = true;
      } else {
        units *= sign === '>' ? 1.5 : 0.5;
        pendingFactor = sign === '>' ? 0.5 : 1.5;
      }
    }
    return units;
  };
  /** Checks a counted length; returns the duration, or undefined after reporting why it can't be used. */
  const toDuration = (units: number, what: Pitch | 'rest') => {
    const d = unitsToDuration(units);
    if (!d) {
      issues.error(lengthError(measure, what));
      return undefined;
    }
    if (d.duration === 'e' && d.dotted) {
      issues.error(dottedEighthError(measure, what === 'rest' ? 'rest' : 'note'));
      return undefined;
    }
    return d;
  };

  while (i < src.length) {
    const ch = src[i];

    if (/\s/.test(ch) || ch === '`' || ch === '\\' || ch === 'y' || ch === ')') {
      i++;
      continue;
    }

    // Bar lines and repeats: | || |] [| :| |: :: — optionally followed by an ending number (|1, :|2).
    if (ch === '|' || ch === ':' || (ch === '[' && peek(1) === '|')) {
      let run = '';
      while (i < src.length && '|:[]'.includes(src[i]) && !(src[i] === '[' && peek(1) !== '|' && !isDigit(peek(1)))) {
        run += src[i++];
      }
      endBar();
      if (run.includes(':')) issues.warn(REPEATS_WARNING);
      if (isDigit(peek())) {
        issues.error(endingsError(measure));
        while (isDigit(peek()) || ((peek() === ',' || peek() === '-') && isDigit(peek(1)))) i++;
      }
      continue;
    }

    if (ch === '[') {
      if (/[A-Za-z]/.test(peek(1)) && peek(2) === ':') {
        const end = src.indexOf(']', i);
        const content = src.slice(i + 1, end === -1 ? src.length : end);
        const name = content[0];
        if (MUSIC_FIELDS.has(name)) readField(name, content.slice(2).trim(), header, issues, measure);
        else issues.warn(MSG.inline);
        i = end === -1 ? src.length : end + 1;
        continue;
      }
      if (isDigit(peek(1))) {
        issues.error(endingsError(measure));
        i += 2;
        continue;
      }
      issues.error(`Measure ${measure}: chords (several notes at once) aren't supported.`);
      eventsInMeasure++;
      barUnknown = true;
      skipPast(']');
      continue;
    }

    if (ch === '"') { issues.warn(MSG.annotations); skipPast('"'); continue; }
    if (ch === '!' || ch === '+') { issues.warn(MSG.decorations); skipPast(ch); continue; }
    if (ch === '{') { issues.warn(MSG.grace); skipPast('}'); continue; }

    if (ch === '(') {
      if (isDigit(peek(1))) {
        issues.error(`Measure ${measure}: triplets and other tuplets aren't supported.`);
        barUnknown = true;
        i += 2;
      } else {
        issues.warn(MSG.slurs);
        i++;
      }
      continue;
    }

    if (ch === '-') { issues.error(`Measure ${measure}: tied notes aren't supported yet.`); i++; continue; }
    if (ch === '>' || ch === '<') {
      issues.error(`Measure ${measure}: a ${ch} sign must come right after a note or rest.`);
      i++;
      continue;
    }
    if (DECORATION_CHARS.has(ch)) { issues.warn(MSG.decorations); i++; continue; }

    if (ch === '^' || ch === '_' || ch === '=' || /[A-Ga-g]/.test(ch)) {
      let accidental = '';
      while ('^_='.includes(peek()) && i < src.length) accidental += src[i++];
      const letter = peek();
      if (!/[A-Ga-g]/.test(letter)) {
        issues.warn(`Skipped an unrecognized symbol in measure ${measure}.`);
        continue;
      }
      i++;
      let octave = letter === letter.toLowerCase() ? 5 : 4;
      while (peek() === ',' || peek() === "'") {
        octave += peek() === "'" ? 1 : -1;
        i++;
      }
      const units = readTimedLength();
      const pitch = letter.toUpperCase() as Pitch;
      eventsInMeasure++;
      barUnits += units;

      if (accidental.includes('^') || accidental.includes('_')) {
        const sign = accidental.includes('^') ? '♯' : '♭';
        issues.error(`Measure ${measure}: ${pitch}${sign} isn't in the key of C. Only white keys are supported for now.`);
        continue;
      }
      if (!isInRange(pitch, octave)) {
        issues.error(rangeError(measure, pitch, octave));
        continue;
      }
      const d = toDuration(units, pitch);
      if (d) events.push(note(pitch, octave as Octave, d.duration, d.dotted));
      continue;
    }

    if (ch === 'z' || ch === 'x') {
      i++;
      const units = readTimedLength();
      eventsInMeasure++;
      barUnits += units;
      const d = toDuration(units, 'rest');
      if (d) events.push(rest(d.duration, d.dotted));
      continue;
    }

    if (ch === 'Z' || ch === 'X') {
      i++;
      let num = '';
      while (isDigit(peek())) num += src[i++];
      const count = num ? Number(num) : 1;
      const d = unitsToDuration(full);
      if (d) for (let k = 0; k < count; k++) events.push(rest(d.duration, d.dotted));
      eventsInMeasure++;
      barUnits += full * count;
      barSpan += count - 1;
      continue;
    }

    issues.warn(`Skipped an unrecognized symbol "${ch}" in measure ${measure}.`);
    i++;
  }
  endBar();

  // Every bar except the last must be full; a short first bar is a pickup and gets rests in front.
  bars.forEach((bar, k) => {
    const needed = full * bar.span;
    if (bar.unknown || k === bars.length - 1 || bar.units === needed) return;
    if (k === 0 && bar.units < needed) return;
    issues.error(`Measure ${bar.measure}: this measure has ${formatBeats(bar.units)} but ${meter} needs ${formatBeats(needed)}.`);
  });
  const first = bars[0];
  if (bars.length > 1 && first && !first.unknown && first.span === 1 && first.units < full) {
    const padding = fillRests(full - first.units);
    if (padding) {
      events.unshift(...padding);
      issues.warn(PICKUP_WARNING);
    }
  }
  return events;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/formats/abc src/formats/importHelpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/abc src/formats/importHelpers.ts src/formats/importHelpers.test.ts && git commit -m "feat(formats): ABC importer with friendly errors"
```

---

### Task 18: MusicXML import (`.musicxml`, `.xml`, `.mxl`)

**Files:**
- Create: `src/formats/musicxml/parseMusicXml.ts`, `src/formats/musicxml/unzipMxl.ts`
- Test: `src/formats/musicxml/parseMusicXml.test.ts`, `src/formats/musicxml/unzipMxl.test.ts`

**Interfaces:**
- Consumes: Task 16 plumbing, `importHelpers` messages and `fillRests` (Task 17), `isInRange`, `unitsToDuration`, `eventUnits`, `measureUnits`, `note`/`rest` factories, types, `Result`/`ok`/`err`
- Produces:
  - `parseMusicXml(xml: string): ImportResult` (uses the global `DOMParser`; tests run under jsdom). `<barline>`: `<repeat>` → warning, `<ending>` → error. A whole-measure rest (`<rest measure="yes">`, or type `whole` outside 4/4) takes its length from `<duration>`. A short first `<measure implicit="yes">` is padded as a pickup.
  - `extractMusicXmlFromMxl(bytes: Uint8Array): Result<string, string>`

- [ ] **Step 1: Write the failing tests**

`src/formats/musicxml/parseMusicXml.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { note, rest } from '../../core/model/factories';
import { eventUnits } from '../../core/theory/rhythm';
import { parseMusicXml } from './parseMusicXml';

interface Opts { title?: string; fifths?: number; beats?: number; parts?: number; divisions?: number; pickup?: boolean }

function score(
  measures: string[],
  { title = 'Mary', fifths = 0, beats = 4, parts = 1, divisions = 1, pickup = false }: Opts = {},
) {
  const attrs = `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths></key>` +
    `<time><beats>${beats}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;
  const measure = (m: string, i: number) =>
    i === 0 && pickup
      ? `<measure number="0" implicit="yes">${attrs}${m}</measure>`
      : `<measure number="${i + 1}">${i === 0 ? attrs : ''}${m}</measure>`;
  const part = (id: number) => `<part id="P${id}">${measures.map(measure).join('')}</part>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><work><work-title>${title}</work-title></work>
<part-list>${Array.from({ length: parts }, (_, i) => `<score-part id="P${i + 1}"><part-name>V</part-name></score-part>`).join('')}</part-list>
${Array.from({ length: parts }, (_, i) => part(i + 1)).join('')}
</score-partwise>`;
}

const n = (step: string, octave: number, type: string, extra = '') =>
  `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><voice>1</voice><type>${type}</type>${extra}</note>`;
const r = (type: string, extra = '') => `<note><rest/><duration>1</duration><voice>1</voice><type>${type}</type>${extra}</note>`;
const units = (events: { duration: 'w' | 'h' | 'q' | 'e'; dotted?: boolean }[]) =>
  events.reduce((sum, e) => sum + eventUnits(e), 0);

function ok(xml: string) {
  const result = parseMusicXml(xml);
  if (!result.ok) throw new Error(result.errors.map((e) => e.message).join('\n'));
  return result;
}
function errors(xml: string) {
  const result = parseMusicXml(xml);
  if (result.ok) throw new Error('expected failure');
  return result.errors.map((e) => e.message);
}

describe('parseMusicXml', () => {
  it('parses a simple melody with title and time signature', () => {
    const { song } = ok(score([n('E', 4, 'quarter') + n('D', 4, 'quarter') + n('C', 4, 'half')], { beats: 4 }));
    expect(song.title).toBe('Mary');
    expect(song.timeSignature).toBe('4/4');
    expect(song.events).toEqual([note('E', 4, 'q'), note('D', 4, 'q'), note('C', 4, 'h')]);
  });

  it('parses dotted notes and rests, including whole-measure rests without a type', () => {
    const measureRest = '<note><rest measure="yes"/><duration>3</duration><voice>1</voice></note>';
    const { song } = ok(score([n('C', 5, 'half', '<dot/>'), measureRest], { beats: 3 }));
    expect(song.events).toEqual([note('C', 5, 'h', true), rest('h', true)]);
  });

  it('reads whole-measure rests from their duration even when the type says whole', () => {
    const measureRest = '<note><rest measure="yes"/><duration>3</duration><voice>1</voice><type>whole</type></note>';
    const unmarked = '<note><rest/><duration>3</duration><voice>1</voice><type>whole</type></note>';
    expect(ok(score([n('C', 5, 'half', '<dot/>'), measureRest], { beats: 3 })).song.events[1]).toEqual(rest('h', true));
    expect(ok(score([n('C', 5, 'half', '<dot/>'), unmarked], { beats: 3 })).song.events[1]).toEqual(rest('h', true));
    expect(ok(score([n('C', 5, 'whole'), r('whole')])).song.events[1]).toEqual(rest('w'));
  });

  it('rejects accidentals, chords, other keys and tuplets', () => {
    expect(errors(score([`<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`])))
      .toEqual(["Measure 1: F♯ isn't in the key of C. Only white keys are supported for now."]);
    expect(errors(score([n('C', 4, 'whole') + n('E', 4, 'whole', '').replace('<note>', '<note><chord/>')])))
      .toEqual(["Measure 1: chords (several notes at once) aren't supported."]);
    expect(errors(score([n('G', 4, 'whole')], { fifths: 1 })))
      .toEqual(["Measure 1: the key signature isn't C major. Only the key of C is supported for now."]);
    expect(errors(score([n('C', 4, 'eighth', '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>')])))
      .toEqual(["Measure 1: triplets and other tuplets aren't supported."]);
  });

  it('rejects multiple voices (backup) and out-of-range notes', () => {
    expect(errors(score([n('C', 4, 'whole') + '<backup><duration>4</duration></backup>' + n('E', 4, 'whole')])))
      .toContain('This part has more than one voice. Only single-melody parts are supported.');
    expect(errors(score([n('F', 3, 'whole')]))).toEqual([
      "Measure 1: an F that low is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
    ]);
  });

  it('rejects unsupported note lengths and dotted eighths', () => {
    expect(errors(score([n('C', 4, '16th')]))).toEqual([
      "Measure 1: one C has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).",
    ]);
    expect(errors(score([n('C', 4, 'eighth', '<dot/>')]))).toEqual(["Measure 1: dotted eighth notes aren't supported yet."]);
    expect(errors(score([r('eighth', '<dot/>')]))).toEqual(["Measure 1: dotted eighth rests aren't supported yet."]);
  });

  it('warns about repeat signs and rejects first and second endings', () => {
    const forward = '<barline location="left"><repeat direction="forward"/></barline>';
    const backward = '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>';
    const { warnings } = ok(score([forward + n('C', 4, 'whole') + backward]));
    expect(warnings.map((w) => w.message)).toEqual(['Repeat signs were ignored — the music is printed once, straight through.']);
    const ending = '<barline location="left"><ending number="1" type="start"/></barline>';
    expect(errors(score([n('C', 4, 'whole'), ending + n('D', 4, 'whole')]))).toEqual([
      "Measure 2: first and second endings aren't supported yet — write the tune out in full.",
    ]);
  });

  it('pads an implicit pickup measure with rests', () => {
    const { song, warnings } = ok(
      score([n('G', 4, 'quarter'), n('C', 5, 'half') + n('E', 5, 'quarter'), n('D', 5, 'half', '<dot/>')], { beats: 3, pickup: true }),
    );
    expect(song.events).toEqual([
      rest('h'), note('G', 4, 'q'), note('C', 5, 'h'), note('E', 5, 'q'), note('D', 5, 'h', true),
    ]);
    expect(units(song.events.slice(0, 2))).toBe(12);
    expect(warnings.map((w) => w.message)).toEqual([
      'The tune starts with a pickup — rests were added at the start so the bar lines line up.',
    ]);
  });

  it('warns when extra parts or lyrics are dropped', () => {
    const { warnings } = ok(score([n('C', 4, 'whole', '<lyric><text>la</text></lyric>')], { parts: 2 }));
    expect(warnings.map((w) => w.message)).toEqual(['Only the first part (instrument) was imported.', 'Lyrics were ignored.']);
  });

  it('rejects files that are not MusicXML', () => {
    expect(errors('<html><body/></html>')).toEqual(["This file isn't a MusicXML score."]);
    expect(errors('not xml at all <')).toEqual(["This file isn't valid MusicXML."]);
  });
});
```

`src/formats/musicxml/unzipMxl.test.ts`:

```ts
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractMusicXmlFromMxl } from './unzipMxl';

describe('extractMusicXmlFromMxl', () => {
  it('follows META-INF/container.xml to the root file', () => {
    const zip = zipSync({
      'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="score/song.xml"/></rootfiles></container>'),
      'score/song.xml': strToU8('<score-partwise/>'),
    });
    expect(extractMusicXmlFromMxl(zip)).toEqual({ ok: true, value: '<score-partwise/>' });
  });

  it('falls back to the first .musicxml file', () => {
    const zip = zipSync({ 'song.musicxml': strToU8('<score-partwise/>') });
    expect(extractMusicXmlFromMxl(zip)).toEqual({ ok: true, value: '<score-partwise/>' });
  });

  it('reports a broken archive', () => {
    expect(extractMusicXmlFromMxl(new Uint8Array([1, 2, 3]))).toEqual({ ok: false, error: "This .mxl file couldn't be opened." });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/formats/musicxml`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/formats/musicxml/unzipMxl.ts`:

```ts
import { strFromU8, unzipSync } from 'fflate';
import { err, ok, type Result } from '../../core/result';

export function extractMusicXmlFromMxl(bytes: Uint8Array): Result<string, string> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return err("This .mxl file couldn't be opened.");
  }
  const container = files['META-INF/container.xml'];
  let path = container ? /full-path="([^"]+)"/.exec(strFromU8(container))?.[1] : undefined;
  path ??= Object.keys(files).find((name) => !name.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(name));
  const file = path ? files[path] : undefined;
  if (!file) return err("This .mxl file doesn't contain a MusicXML score.");
  return ok(strFromU8(file));
}
```

`src/formats/musicxml/parseMusicXml.ts`:

```ts
import { note, rest } from '../../core/model/factories';
import {
  PITCHES, TIME_SIGNATURES, type MusicEvent, type Octave, type Pitch, type TimeSignature,
} from '../../core/model/types';
import { isInRange } from '../../core/theory/pitch';
import { eventUnits, measureUnits, unitsToDuration } from '../../core/theory/rhythm';
import { finalizeImport } from '../finalize';
import {
  dottedEighthError, endingsError, fillRests, lengthError, PICKUP_WARNING, rangeError, REPEATS_WARNING, timeChangeError,
} from '../importHelpers';
import { IssueCollector } from '../issues';
import { importFailure, type ImportResult } from '../types';

const TYPE_UNITS: Record<string, number> = { whole: 16, half: 8, quarter: 4, eighth: 2 };
const VOICES_MSG = 'This part has more than one voice. Only single-melody parts are supported.';

const childrenNamed = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);
const childNamed = (el: Element | undefined, name: string): Element | undefined =>
  el ? childrenNamed(el, name)[0] : undefined;
const textOf = (el: Element | undefined, name: string): string | undefined => {
  const value = childNamed(el, name)?.textContent?.trim();
  return value ? value : undefined;
};

export function parseMusicXml(xml: string): ImportResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return importFailure(["This file isn't valid MusicXML."]);
  const root = doc.documentElement;
  if (root.localName === 'score-timewise') {
    return importFailure(["Timewise MusicXML isn't supported — export it again as standard (partwise) MusicXML."]);
  }
  if (root.localName !== 'score-partwise') return importFailure(["This file isn't a MusicXML score."]);

  const issues = new IssueCollector();
  const title = textOf(childNamed(root, 'work'), 'work-title') ?? textOf(root, 'movement-title');
  const parts = childrenNamed(root, 'part');
  if (parts.length === 0) return importFailure(['This score has no music in it.']);
  if (parts.length > 1) issues.warn('Only the first part (instrument) was imported.');

  const events: MusicEvent[] = [];
  let divisions = 1;
  let timeSignature: TimeSignature | undefined;
  let voice: string | undefined;

  const readAttributes = (el: Element, m: number) => {
    const d = Number(textOf(el, 'divisions'));
    if (d > 0) divisions = d;
    const key = childNamed(el, 'key');
    if (key && Number(textOf(key, 'fifths') ?? '0') !== 0) {
      issues.error(`Measure ${m}: the key signature isn't C major. Only the key of C is supported for now.`);
    }
    const time = childNamed(el, 'time');
    if (time) {
      const ts = `${textOf(time, 'beats')}/${textOf(time, 'beat-type')}`;
      if (!(TIME_SIGNATURES as readonly string[]).includes(ts)) {
        issues.error(`The time signature ${ts} isn't supported yet — use 2/4, 3/4 or 4/4.`);
      } else if (timeSignature && timeSignature !== ts) {
        issues.error(timeChangeError(m));
      } else {
        timeSignature = ts as TimeSignature;
      }
    }
    if (Number(textOf(el, 'staves') ?? '1') > 1) {
      issues.error("Piano-style (two-staff) parts aren't supported. Export just the melody.");
    }
    const clef = childNamed(el, 'clef');
    if (clef && textOf(clef, 'sign') !== 'G') issues.warn('The music was moved to the treble clef.');
  };

  const readBarline = (el: Element, m: number) => {
    if (childNamed(el, 'ending')) issues.error(endingsError(m));
    else if (childNamed(el, 'repeat')) issues.warn(REPEATS_WARNING);
  };

  const readNote = (el: Element, m: number) => {
    if (childNamed(el, 'grace')) { issues.warn('Grace notes were ignored.'); return; }
    if (childNamed(el, 'cue')) return;
    if (childNamed(el, 'chord')) { issues.error(`Measure ${m}: chords (several notes at once) aren't supported.`); return; }
    const v = textOf(el, 'voice') ?? '1';
    voice ??= v;
    if (v !== voice) { issues.error(VOICES_MSG); return; }
    if (childNamed(el, 'time-modification')) { issues.error(`Measure ${m}: triplets and other tuplets aren't supported.`); return; }
    if (childrenNamed(el, 'tie').some((t) => t.getAttribute('type') === 'start')) {
      issues.error(`Measure ${m}: tied notes aren't supported yet.`);
      return;
    }
    if (childNamed(el, 'lyric')) issues.warn('Lyrics were ignored.');

    const restEl = childNamed(el, 'rest');
    const pitchEl = childNamed(el, 'pitch');
    const step = textOf(pitchEl, 'step');
    const octave = Number(textOf(pitchEl, 'octave'));
    if (!restEl && (!pitchEl || !step || !(PITCHES as readonly string[]).includes(step) || Number.isNaN(octave))) {
      issues.warn(`Skipped an unpitched note in measure ${m}.`);
      return;
    }
    const pitch = step as Pitch;
    const subject: Pitch | 'rest' = restEl ? 'rest' : pitch;

    const dots = childrenNamed(el, 'dot').length;
    if (dots > 1) { issues.error(`Measure ${m}: double-dotted notes aren't supported.`); return; }

    const type = textOf(el, 'type');
    // A whole-measure rest fills the bar whatever its <type> says (Finale/MuseScore write type "whole" in 3/4).
    const measureRest =
      restEl !== undefined && (restEl.getAttribute('measure') === 'yes' || (type === 'whole' && (timeSignature ?? '4/4') !== '4/4'));
    let units: number;
    if (type && !measureRest) {
      const base = TYPE_UNITS[type];
      if (base === undefined) { issues.error(lengthError(m, subject)); return; }
      units = dots ? base * 1.5 : base;
    } else {
      units = (Number(textOf(el, 'duration') ?? '0') / divisions) * 4;
    }
    const d = unitsToDuration(units);
    if (!d) { issues.error(lengthError(m, subject)); return; }
    if (d.duration === 'e' && d.dotted) { issues.error(dottedEighthError(m, restEl ? 'rest' : 'note')); return; }

    if (restEl) {
      events.push(rest(d.duration, d.dotted));
      return;
    }
    const alter = Number(textOf(pitchEl, 'alter') ?? '0');
    if (alter !== 0) {
      issues.error(`Measure ${m}: ${pitch}${alter > 0 ? '♯' : '♭'} isn't in the key of C. Only white keys are supported for now.`);
      return;
    }
    if (!isInRange(pitch, octave)) {
      issues.error(rangeError(m, pitch, octave));
      return;
    }
    events.push(note(pitch, octave as Octave, d.duration, d.dotted));
  };

  const measures = childrenNamed(parts[0], 'measure');
  let firstMeasureEvents = 0;
  measures.forEach((measureEl, index) => {
    const m = index + 1;
    for (const el of Array.from(measureEl.children)) {
      switch (el.localName) {
        case 'attributes': readAttributes(el, m); break;
        case 'backup':
        case 'forward': issues.error(VOICES_MSG); break;
        case 'barline': readBarline(el, m); break;
        case 'direction': issues.warn('Dynamics, tempo and text directions were ignored.'); break;
        case 'harmony': issues.warn('Chord symbols were ignored.'); break;
        case 'note': readNote(el, m); break;
        default: break;
      }
    }
    if (index === 0) firstMeasureEvents = events.length;
  });

  if (!timeSignature) issues.warn('No time signature was found — using 4/4.');
  const meter = timeSignature ?? '4/4';

  // A short first measure marked implicit is a pickup: put rests in front so the bar lines line up.
  const pickupUnits = events.slice(0, firstMeasureEvents).reduce((sum, e) => sum + eventUnits(e), 0);
  if (measures.length > 1 && measures[0].getAttribute('implicit') === 'yes' && pickupUnits > 0 && pickupUnits < measureUnits(meter)) {
    const padding = fillRests(measureUnits(meter) - pickupUnits);
    if (padding) {
      events.unshift(...padding);
      issues.warn(PICKUP_WARNING);
    }
  }

  return finalizeImport(
    { schemaVersion: 1, id: 'imported', title: title ?? 'Untitled Song', timeSignature: meter, events },
    issues,
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/formats/musicxml`
Expected: PASS. (If jsdom reports `parsererror` differently for `'not xml at all <'`, the check `getElementsByTagName('parsererror')` is the standard signal in both jsdom and browsers.)

- [ ] **Step 5: Commit**

```bash
git add src/formats/musicxml && git commit -m "feat(formats): MusicXML and .mxl importer"
```

---

### Task 19: `importSong` — format detection and fresh ids

**Files:**
- Create: `src/formats/importSong.ts`
- Test: `src/formats/importSong.test.ts`

**Interfaces:**
- Consumes: `parseAbc` (17), `parseMusicXml`, `extractMusicXmlFromMxl` (18), `parseNoteChompJson` (16), `newSongId` (2)
- Produces:
  - `type ImportSource = { kind: 'text'; text: string } | { kind: 'file'; name: string; bytes: Uint8Array }`
  - `type DetectedFormat = 'abc' | 'musicxml' | 'mxl' | 'notechomp'`
  - `detectFormat(source: ImportSource): DetectedFormat` — by extension (`.mxl`, `.musicxml`/`.xml`, `.json`, `.abc`), else by content (`<` → MusicXML, `{` → JSON, otherwise ABC)
  - `importSong(source: ImportSource): ImportResult` — successful results always get a **new** id

- [ ] **Step 1: Write the failing test**

`src/formats/importSong.test.ts`:

```ts
// @vitest-environment jsdom
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import { serializeSong } from './notechomp/notechomp';
import { detectFormat, importSong } from './importSong';

const ABC = 'X:1\nT:Tiny\nM:4/4\nL:1/4\nK:C\nC D E F|\n';
const XML = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1">
<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;

describe('detectFormat', () => {
  it('uses the file extension first', () => {
    const bytes = new Uint8Array();
    expect(detectFormat({ kind: 'file', name: 'a.MXL', bytes })).toBe('mxl');
    expect(detectFormat({ kind: 'file', name: 'a.musicxml', bytes })).toBe('musicxml');
    expect(detectFormat({ kind: 'file', name: 'a.xml', bytes })).toBe('musicxml');
    expect(detectFormat({ kind: 'file', name: 'a.notechomp.json', bytes })).toBe('notechomp');
    expect(detectFormat({ kind: 'file', name: 'a.abc', bytes })).toBe('abc');
  });
  it('sniffs pasted text', () => {
    expect(detectFormat({ kind: 'text', text: '  <?xml ...' })).toBe('musicxml');
    expect(detectFormat({ kind: 'text', text: '{"schemaVersion":1}' })).toBe('notechomp');
    expect(detectFormat({ kind: 'text', text: ABC })).toBe('abc');
  });
});

describe('importSong', () => {
  it('imports pasted ABC with a fresh id', () => {
    const result = importSong({ kind: 'text', text: ABC });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.song.id).not.toBe('imported');
  });

  it('gives an imported Note Chomp file a new id', () => {
    const original = { ...createEmptySong('Mine'), events: [note('C', 4, 'w')] };
    const result = importSong({ kind: 'file', name: 'mine.notechomp.json', bytes: strToU8(serializeSong(original)) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.song.id).not.toBe(original.id);
      expect(result.song.events).toEqual(original.events);
    }
  });

  it('imports MusicXML text and .mxl archives', () => {
    expect(importSong({ kind: 'text', text: XML }).ok).toBe(true);
    const mxl = zipSync({ 'score.xml': strToU8(XML) });
    const result = importSong({ kind: 'file', name: 'score.mxl', bytes: mxl });
    expect(result.ok).toBe(true);
  });

  it('passes through failures', () => {
    expect(importSong({ kind: 'file', name: 'bad.mxl', bytes: new Uint8Array([0]) })).toEqual({
      ok: false, errors: [{ message: "This .mxl file couldn't be opened." }],
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/formats/importSong.test.ts`
Expected: FAIL — cannot resolve `./importSong`.

- [ ] **Step 3: Implement `src/formats/importSong.ts`**

```ts
import { newSongId } from '../core/model/id';
import { parseAbc } from './abc/parseAbc';
import { extractMusicXmlFromMxl } from './musicxml/unzipMxl';
import { parseMusicXml } from './musicxml/parseMusicXml';
import { parseNoteChompJson } from './notechomp/notechomp';
import { importFailure, type ImportResult } from './types';

export type ImportSource = { kind: 'text'; text: string } | { kind: 'file'; name: string; bytes: Uint8Array };
export type DetectedFormat = 'abc' | 'musicxml' | 'mxl' | 'notechomp';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

export function detectFormat(source: ImportSource): DetectedFormat {
  if (source.kind === 'file') {
    const name = source.name.toLowerCase();
    if (name.endsWith('.mxl')) return 'mxl';
    if (name.endsWith('.musicxml') || name.endsWith('.xml')) return 'musicxml';
    if (name.endsWith('.json')) return 'notechomp';
    if (name.endsWith('.abc')) return 'abc';
  }
  const text = (source.kind === 'text' ? source.text : decode(source.bytes)).trimStart();
  if (text.startsWith('<')) return 'musicxml';
  if (text.startsWith('{')) return 'notechomp';
  return 'abc';
}

export function importSong(source: ImportSource): ImportResult {
  const format = detectFormat(source);
  let result: ImportResult;
  if (format === 'mxl' && source.kind === 'file') {
    const extracted = extractMusicXmlFromMxl(source.bytes);
    result = extracted.ok ? parseMusicXml(extracted.value) : importFailure([extracted.error]);
  } else {
    const text = source.kind === 'text' ? source.text : decode(source.bytes);
    result =
      format === 'musicxml' ? parseMusicXml(text) : format === 'notechomp' ? parseNoteChompJson(text) : parseAbc(text);
  }
  return result.ok ? { ...result, song: { ...result.song, id: newSongId() } } : result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/formats`
Expected: PASS.

- [ ] **Step 5: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test`

```bash
git add src/formats && git commit -m "feat(formats): importSong with format detection"
```
