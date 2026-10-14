import { note, rest } from '../../core/model/factories';
import {
  TIME_SIGNATURES,
  type MusicEvent,
  type Octave,
  type Pitch,
  type TimeSignature,
} from '../../core/model/types';
import { isInRange } from '../../core/theory/pitch';
import { formatBeats, measureUnits, unitsToDuration } from '../../core/theory/rhythm';
import { finalizeImport } from '../finalize';
import {
  dottedEighthError,
  endingsError,
  fillRests,
  lengthError,
  PICKUP_WARNING,
  rangeError,
  REPEATS_WARNING,
  timeChangeError,
} from '../importHelpers';
import { IssueCollector } from '../issues';
import { importFailure, type ImportResult } from '../types';

/** Letter + first three letters of the mode ('' = major, 'm' = minor). Every one of these uses only white keys. */
const SUPPORTED_KEYS = new Set([
  'C',
  'Cmaj',
  'Cma',
  'Cion',
  'Cio',
  'Am',
  'Amin',
  'Ami',
  'Aaeo',
  'Aae',
  'Ddor',
  'Ephr',
  'Flyd',
  'Gmix',
  'Bloc',
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
  /** A K: field was seen (every real ABC tune has one). */
  sawKey: boolean;
  /** Characters in the tune body we couldn't read. */
  skipped: number;
}

export const NOT_MUSIC_ERROR = 'No notes were found. Is this ABC, MusicXML or a Note Chomp file?';

export function skippedWarning(count: number): string {
  return `Skipped ${count} ${count === 1 ? 'character' : 'characters'} we didn't understand.`;
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
function readField(
  name: string,
  value: string,
  header: Header,
  issues: IssueCollector,
  measure?: number,
): void {
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
      header.sawKey = true;
      if (!isSupportedKey(value))
        issues.error(
          `This tune is in the key of ${value}. Only the key of C is supported for now.`,
        );
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
  const header: Header = { meter: '4/4', voices: new Set(), sawKey: false, skipped: 0 };
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
  if (header.skipped > 0) {
    // Plain text (a shopping list, a sentence) is mostly letters we can't read, plus a few a–g.
    const notes = events.filter((e) => e.kind === 'note').length;
    const looksLikeText = !header.sawKey || header.skipped > notes;
    // A real error (a sharp, a bad meter) says more than "no notes were found".
    if (looksLikeText && !issues.hasErrors) return importFailure([NOT_MUSIC_ERROR]);
    issues.warn(skippedWarning(header.skipped));
  }

  return finalizeImport(
    {
      schemaVersion: 1,
      id: 'imported',
      title: header.title || 'Untitled Song',
      timeSignature: header.meter,
      events,
    },
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
        issues.error(
          `Measure ${measure}: ${sign}${sign} rhythms need sixteenth notes, which Note Chomp can't show yet.`,
        );
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
      while (
        i < src.length &&
        '|:[]'.includes(src[i]) &&
        !(src[i] === '[' && peek(1) !== '|' && !isDigit(peek(1)))
      ) {
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
        if (MUSIC_FIELDS.has(name))
          readField(name, content.slice(2).trim(), header, issues, measure);
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

    if (ch === '"') {
      issues.warn(MSG.annotations);
      skipPast('"');
      continue;
    }
    if (ch === '!' || ch === '+') {
      issues.warn(MSG.decorations);
      skipPast(ch);
      continue;
    }
    if (ch === '{') {
      issues.warn(MSG.grace);
      skipPast('}');
      continue;
    }

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

    if (ch === '-') {
      issues.error(`Measure ${measure}: tied notes aren't supported yet.`);
      i++;
      continue;
    }
    if (ch === '>' || ch === '<') {
      issues.error(`Measure ${measure}: a ${ch} sign must come right after a note or rest.`);
      i++;
      continue;
    }
    if (DECORATION_CHARS.has(ch)) {
      issues.warn(MSG.decorations);
      i++;
      continue;
    }

    if (ch === '^' || ch === '_' || ch === '=' || /[A-Ga-g]/.test(ch)) {
      let accidental = '';
      while ('^_='.includes(peek()) && i < src.length) accidental += src[i++];
      const letter = peek();
      if (!/[A-Ga-g]/.test(letter)) {
        header.skipped++;
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
        issues.error(
          `Measure ${measure}: ${pitch}${sign} isn't in the key of C. Only white keys are supported for now.`,
        );
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

    header.skipped++;
    i++;
  }
  endBar();

  // Every bar except the last must be full; a short first bar is a pickup and gets rests in front.
  bars.forEach((bar, k) => {
    const needed = full * bar.span;
    if (bar.unknown || k === bars.length - 1 || bar.units === needed) return;
    if (k === 0 && bar.units < needed) return;
    issues.error(
      `Measure ${bar.measure}: this measure has ${formatBeats(bar.units)} but ${meter} needs ${formatBeats(needed)}.`,
    );
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
