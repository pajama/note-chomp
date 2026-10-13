import { describe, expect, it } from 'vitest';
import { note, rest } from '../../core/model/factories';
import { eventUnits } from '../../core/theory/rhythm';
import { parseAbc } from './parseAbc';

const tune = (body: string, header = 'X:1\nT:Test Tune\nM:4/4\nL:1/4\nK:C') =>
  `${header}\n${body}\n`;

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
    const { song, warnings } = expectOk(
      tune('E D C2 | E D C2 | C/2C/2C/2C/2 D/2D/2D/2D/2 | E D C2 |]'),
    );
    expect(song.title).toBe('Test Tune');
    expect(song.timeSignature).toBe('4/4');
    expect(song.events).toHaveLength(17);
    expect(song.events.slice(0, 3)).toEqual([
      note('E', 4, 'q'),
      note('D', 4, 'q'),
      note('C', 4, 'h'),
    ]);
    expect(song.events[6]).toEqual(note('C', 4, 'e'));
    expect(warnings).toEqual([]);
  });

  it('uses 1/8 as the default length in 4/4 and 1/16 in 2/4', () => {
    expect(expectOk(tune('CDEF GABc |', 'X:1\nT:t\nM:4/4\nK:C')).song.events[0]).toEqual(
      note('C', 4, 'e'),
    );
    expect(expectOk(tune('C2D2 E4 |', 'X:1\nT:t\nM:2/4\nK:C')).song.events[0]).toEqual(
      note('C', 4, 'e'),
    );
  });

  it('handles octave marks across G3–C6', () => {
    const { song } = expectOk(tune("G, A, B, C | c' z3 |"));
    expect(song.events.slice(0, 5)).toEqual([
      note('G', 3, 'q'),
      note('A', 3, 'q'),
      note('B', 3, 'q'),
      note('C', 4, 'q'),
      note('C', 6, 'q'),
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
      note('C', 4, 'e'),
      note('D', 4, 'q', true),
      note('E', 4, 'h'),
      rest('q', true),
      note('G', 4, 'e'),
      note('A', 4, 'h'),
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
    expect(expectErrors(tune('_B4 |'))[0]).toBe(
      "Measure 1: B♭ isn't in the key of C. Only white keys are supported for now.",
    );
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
    expect(expectErrors(tune('[CEG] D E F |'))).toEqual([
      "Measure 1: chords (several notes at once) aren't supported.",
    ]);
    expect(expectErrors(tune('C2- C2 |'))).toEqual(["Measure 1: tied notes aren't supported yet."]);
    expect(expectErrors(tune('(3CDE C |'))).toEqual([
      "Measure 1: triplets and other tuplets aren't supported.",
    ]);
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
    expect(expectOk(tune('C4 | [M:4/4] D4 |')).song.events).toEqual([
      note('C', 4, 'w'),
      note('D', 4, 'w'),
    ]);
    expect(expectErrors(tune('C4 | [M:3/4] D3 |'))).toEqual([
      "Measure 2: time signature changes aren't supported.",
    ]);
    expect(expectErrors(tune('C4 |\nM:2/4\nD2 |'))).toEqual([
      "Measure 2: time signature changes aren't supported.",
    ]);
    expect(expectErrors(tune('C4 | [K:G] D4 |'))).toEqual([
      'This tune is in the key of G. Only the key of C is supported for now.',
    ]);
    expect(expectOk(tune('C4 | [K:Am] D4 |')).song.events).toHaveLength(2);
    expect(expectOk(tune('[P:A] C4 |')).warnings.map((w) => w.message)).toEqual([
      'Inline fields (like [P:A]) were ignored.',
    ]);
  });

  it('reports bar-crossing notes from validation', () => {
    expect(expectErrors(tune('C3 D2 |'))[0]).toMatch(/^Measure 1: the half note doesn't fit/);
  });

  it('pads a pickup bar with rests so the bar lines line up', () => {
    const { song, warnings } = expectOk(tune('G | c2 e | d2 |', 'X:1\nT:t\nM:3/4\nL:1/4\nK:C'));
    expect(song.events).toEqual([
      rest('h'),
      note('G', 4, 'q'),
      note('C', 5, 'h'),
      note('E', 5, 'q'),
      note('D', 5, 'h'),
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
    expect(expectErrors(tune('C4 | D3 | E4 |'))).toEqual([
      'Measure 2: this measure has 3 beats but 4/4 needs 4 beats.',
    ]);
    expect(expectErrors(tune('C4 | D2 E3/2 | E4 |'))).toEqual([
      'Measure 2: this measure has 3½ beats but 4/4 needs 4 beats.',
    ]);
    expect(expectErrors(tune('C4 D | E4 |'))).toEqual([
      'Measure 1: this measure has 5 beats but 4/4 needs 4 beats.',
    ]);
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
    const message = (m: number) =>
      `Measure ${m}: first and second endings aren't supported yet — write the tune out in full.`;
    expect(expectErrors(tune('|: C4 |1 D4 :|2 E4 |]'))).toEqual([message(2), message(3)]);
    expect(expectErrors(tune('|: C4 | [1 D4 :| [2 E4 |]'))).toEqual([message(2), message(3)]);
  });

  it('imports only the first tune of a multi-tune file', () => {
    const { song, warnings } = expectOk(`${tune('C4 |')}\nX:2\nT:Second\nK:C\nD4|\n`);
    expect(song.title).toBe('Test Tune');
    expect(song.events).toEqual([note('C', 4, 'w')]);
    expect(warnings.map((w) => w.message)).toContain(
      'This file has several tunes — only the first one was imported.',
    );
  });
});
