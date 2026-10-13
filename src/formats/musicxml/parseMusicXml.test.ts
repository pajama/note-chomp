// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { note, rest } from '../../core/model/factories';
import { eventUnits } from '../../core/theory/rhythm';
import { parseMusicXml } from './parseMusicXml';

interface Opts {
  title?: string;
  fifths?: number;
  beats?: number;
  parts?: number;
  divisions?: number;
  pickup?: boolean;
}

function score(
  measures: string[],
  { title = 'Mary', fifths = 0, beats = 4, parts = 1, divisions = 1, pickup = false }: Opts = {},
) {
  const attrs =
    `<attributes><divisions>${divisions}</divisions><key><fifths>${fifths}</fifths></key>` +
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
const r = (type: string, extra = '') =>
  `<note><rest/><duration>1</duration><voice>1</voice><type>${type}</type>${extra}</note>`;
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
    const { song } = ok(
      score([n('E', 4, 'quarter') + n('D', 4, 'quarter') + n('C', 4, 'half')], { beats: 4 }),
    );
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
    const measureRest =
      '<note><rest measure="yes"/><duration>3</duration><voice>1</voice><type>whole</type></note>';
    const unmarked = '<note><rest/><duration>3</duration><voice>1</voice><type>whole</type></note>';
    expect(
      ok(score([n('C', 5, 'half', '<dot/>'), measureRest], { beats: 3 })).song.events[1],
    ).toEqual(rest('h', true));
    expect(ok(score([n('C', 5, 'half', '<dot/>'), unmarked], { beats: 3 })).song.events[1]).toEqual(
      rest('h', true),
    );
    expect(ok(score([n('C', 5, 'whole'), r('whole')])).song.events[1]).toEqual(rest('w'));
  });

  it('rejects accidentals, chords, other keys and tuplets', () => {
    expect(
      errors(
        score([
          `<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`,
        ]),
      ),
    ).toEqual(["Measure 1: F♯ isn't in the key of C. Only white keys are supported for now."]);
    expect(
      errors(
        score([n('C', 4, 'whole') + n('E', 4, 'whole', '').replace('<note>', '<note><chord/>')]),
      ),
    ).toEqual(["Measure 1: chords (several notes at once) aren't supported."]);
    expect(errors(score([n('G', 4, 'whole')], { fifths: 1 }))).toEqual([
      "Measure 1: the key signature isn't C major. Only the key of C is supported for now.",
    ]);
    expect(
      errors(
        score([
          n(
            'C',
            4,
            'eighth',
            '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>',
          ),
        ]),
      ),
    ).toEqual(["Measure 1: triplets and other tuplets aren't supported."]);
  });

  it('rejects multiple voices (backup) and out-of-range notes', () => {
    expect(
      errors(
        score([
          n('C', 4, 'whole') + '<backup><duration>4</duration></backup>' + n('E', 4, 'whole'),
        ]),
      ),
    ).toContain('This part has more than one voice. Only single-melody parts are supported.');
    expect(errors(score([n('F', 3, 'whole')]))).toEqual([
      "Measure 1: an F that low is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
    ]);
  });

  it('rejects unsupported note lengths and dotted eighths', () => {
    expect(errors(score([n('C', 4, '16th')]))).toEqual([
      "Measure 1: one C has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).",
    ]);
    expect(errors(score([n('C', 4, 'eighth', '<dot/>')]))).toEqual([
      "Measure 1: dotted eighth notes aren't supported yet.",
    ]);
    expect(errors(score([r('eighth', '<dot/>')]))).toEqual([
      "Measure 1: dotted eighth rests aren't supported yet.",
    ]);
  });

  it('warns about repeat signs and rejects first and second endings', () => {
    const forward = '<barline location="left"><repeat direction="forward"/></barline>';
    const backward =
      '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>';
    const { warnings } = ok(score([forward + n('C', 4, 'whole') + backward]));
    expect(warnings.map((w) => w.message)).toEqual([
      'Repeat signs were ignored — the music is printed once, straight through.',
    ]);
    const ending = '<barline location="left"><ending number="1" type="start"/></barline>';
    expect(errors(score([n('C', 4, 'whole'), ending + n('D', 4, 'whole')]))).toEqual([
      "Measure 2: first and second endings aren't supported yet — write the tune out in full.",
    ]);
  });

  it('pads an implicit pickup measure with rests', () => {
    const { song, warnings } = ok(
      score(
        [
          n('G', 4, 'quarter'),
          n('C', 5, 'half') + n('E', 5, 'quarter'),
          n('D', 5, 'half', '<dot/>'),
        ],
        { beats: 3, pickup: true },
      ),
    );
    expect(song.events).toEqual([
      rest('h'),
      note('G', 4, 'q'),
      note('C', 5, 'h'),
      note('E', 5, 'q'),
      note('D', 5, 'h', true),
    ]);
    expect(units(song.events.slice(0, 2))).toBe(12);
    expect(warnings.map((w) => w.message)).toEqual([
      'The tune starts with a pickup — rests were added at the start so the bar lines line up.',
    ]);
  });

  it('rejects a middle measure that is too short or too long', () => {
    const q = n('C', 4, 'quarter');
    expect(errors(score([q.repeat(4), q.repeat(3), q.repeat(4), q.repeat(4)]))).toEqual([
      'Measure 2: this measure has 3 beats but 4/4 needs 4 beats.',
    ]);
    expect(errors(score([q.repeat(4), q.repeat(5), q.repeat(4)]))).toEqual([
      'Measure 2: this measure has 5 beats but 4/4 needs 4 beats.',
    ]);
    expect(errors(score([q.repeat(5), q.repeat(4)]))).toEqual([
      'Measure 1: this measure has 5 beats but 4/4 needs 4 beats.',
    ]);
  });

  it('accepts a short last measure', () => {
    const q = n('C', 4, 'quarter');
    expect(ok(score([q.repeat(4), q.repeat(2)])).song.events).toHaveLength(6);
  });

  it('pads a short first measure as a pickup even without implicit="yes"', () => {
    const { song, warnings } = ok(score([n('G', 4, 'quarter'), n('C', 5, 'whole')]));
    expect(song.events).toEqual([rest('h', true), note('G', 4, 'q'), note('C', 5, 'w')]);
    expect(warnings.map((w) => w.message)).toEqual([
      'The tune starts with a pickup — rests were added at the start so the bar lines line up.',
    ]);
  });

  it('joins a short measure with a following implicit measure (a bar split by a repeat sign)', () => {
    const q = n('C', 4, 'quarter');
    const xml = score([q.repeat(4), q.repeat(3), q, q.repeat(4)]).replace(
      '<measure number="3">',
      '<measure number="3" implicit="yes">',
    );
    expect(ok(xml).song.events).toHaveLength(12);
  });

  it('does not count measure lengths when a note in the measure was rejected', () => {
    expect(
      errors(score([n('C', 4, 'quarter').repeat(3) + n('C', 4, '16th'), n('C', 4, 'whole')])),
    ).toEqual([
      "Measure 1: one C has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).",
    ]);
  });

  it('warns when extra parts or lyrics are dropped', () => {
    const { warnings } = ok(
      score([n('C', 4, 'whole', '<lyric><text>la</text></lyric>')], { parts: 2 }),
    );
    expect(warnings.map((w) => w.message)).toEqual([
      'Only the first part (instrument) was imported.',
      'Lyrics were ignored.',
    ]);
  });

  it('rejects files that are not MusicXML', () => {
    expect(errors('<html><body/></html>')).toEqual(["This file isn't a MusicXML score."]);
    expect(errors('not xml at all <')).toEqual(["This file isn't valid MusicXML."]);
  });
});
