import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import type { MusicEvent, TimeSignature } from '../model/types';
import { PALETTE } from '../palette/palette';
import { MIDDLE_LINE_STEP } from '../theory/pitch';
import { splitIntoMeasures } from '../theory/rhythm';
import { METRICS, stepY } from './metrics';
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from './options';
import { layoutSystem } from './system';
import type { LayoutItem } from './types';

const S = 10;
const TOP = 50;

function build(
  events: MusicEvent[],
  options: Partial<RenderOptions> = {},
  justify = false,
  timeSignature: TimeSignature = '4/4',
) {
  const result = splitIntoMeasures(events, timeSignature);
  if (!result.ok) throw new Error(result.error.message);
  return layoutSystem({
    index: 0,
    measures: result.value,
    timeSignature,
    staffTop: TOP,
    left: 10,
    width: 300,
    spacing: S,
    options: { ...DEFAULT_RENDER_OPTIONS, ...options },
    justify,
    isFinalSystem: true,
  });
}

const ofKind = <K extends LayoutItem['kind']>(items: LayoutItem[], kind: K) =>
  items.filter((i): i is Extract<LayoutItem, { kind: K }> => i.kind === kind);

const MIDDLE_Y = stepY(TOP, S, MIDDLE_LINE_STEP);

describe('layoutSystem', () => {
  it('draws the staff and the monster even with no measures', () => {
    const sys = build([]);
    expect(ofKind(sys.items, 'staff')).toHaveLength(1);
    expect(ofKind(sys.items, 'monster')).toHaveLength(1);
    expect(ofKind(sys.items, 'barLine')).toHaveLength(0);
    expect(sys.endX).toBe(sys.startX);
  });

  it('centres the monster on the middle line', () => {
    const [monster] = ofKind(build([]).items, 'monster');
    expect(monster.y + monster.height / 2).toBeCloseTo(TOP + 2 * S);
  });

  it('places E4 on the bottom line and C4 on a ledger line', () => {
    const sys = build([note('E', 4, 'q'), note('C', 4, 'q')]);
    const [e4, c4] = ofKind(sys.items, 'fruit');
    expect(e4.y).toBeCloseTo(TOP + 4 * S);
    expect(c4.y).toBeCloseTo(TOP + 5 * S);
    const ledgers = ofKind(sys.items, 'ledger');
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0].y).toBeCloseTo(TOP + 5 * S);
  });

  it('makes half and whole notes hollow and gives whole notes no stem', () => {
    const sys = build([note('C', 5, 'h'), note('D', 5, 'q'), note('E', 5, 'q'), note('F', 5, 'w')]);
    expect(ofKind(sys.items, 'fruit').map((f) => f.hollow)).toEqual([true, false, false, true]);
    expect(ofKind(sys.items, 'stem')).toHaveLength(3);
  });

  it('points stems down from the middle line and up below it', () => {
    const sys = build([note('B', 4, 'q'), note('A', 4, 'q')]);
    const [b4, a4] = ofKind(sys.items, 'stem');
    expect(b4.y2).toBeGreaterThan(b4.y1);
    expect(a4.y2).toBeLessThan(a4.y1);
    expect(a4.y1 - a4.y2).toBeCloseTo(METRICS.stemLength * S);
  });

  it('stretches stems of far ledger notes to reach the middle line', () => {
    const [g3, c6] = ofKind(build([note('G', 3, 'q'), note('C', 6, 'q')]).items, 'stem');
    expect(g3.y2).toBeLessThan(g3.y1);
    expect(g3.y2).toBeLessThanOrEqual(MIDDLE_Y + 1e-9);
    expect(c6.y2).toBeGreaterThan(c6.y1);
    expect(c6.y2).toBeGreaterThanOrEqual(MIDDLE_Y - 1e-9);
  });

  it('extends every beamed stem to the middle line when a note is far below it', () => {
    const sys = build([note('G', 3, 'e'), note('B', 3, 'e')]);
    const [beam] = ofKind(sys.items, 'beam');
    expect(beam.direction).toBe('up');
    expect(beam.y1).toBeLessThanOrEqual(MIDDLE_Y + 1e-9);
    for (const stem of ofKind(sys.items, 'stem')) expect(stem.y2).toBeCloseTo(beam.y1);
  });

  it('points a beam the way of the note farthest from the middle line (a tie points down)', () => {
    // F4 is 3 steps below the middle line, D5 only 2 above → up
    const up = build([note('F', 4, 'e'), note('D', 5, 'e')]);
    expect(ofKind(up.items, 'beam')[0].direction).toBe('up');
    for (const stem of ofKind(up.items, 'stem')) expect(stem.y2).toBeLessThan(stem.y1);
    // G4 and D5 are both 2 steps away → down
    const tie = build([note('G', 4, 'e'), note('D', 5, 'e')]);
    expect(ofKind(tie.items, 'beam')[0].direction).toBe('down');
    for (const stem of ofKind(tie.items, 'stem')) expect(stem.y2).toBeGreaterThan(stem.y1);
  });

  it('beams an eighth pair with a shared stem tip and no flags', () => {
    const sys = build([note('C', 4, 'e'), note('E', 4, 'e')]);
    expect(ofKind(sys.items, 'beam')).toHaveLength(1);
    expect(ofKind(sys.items, 'flag')).toHaveLength(0);
    const [s1, s2] = ofKind(sys.items, 'stem');
    expect(s1.y2).toBeCloseTo(s2.y2);
    const [beam] = ofKind(sys.items, 'beam');
    expect(beam.color).not.toBe(PALETTE.C.stroke);
    expect(beam.direction).toBe('up');
    expect(beam.y1).toBeCloseTo(s1.y2);
  });

  it('flags a lone eighth note', () => {
    const sys = build([note('G', 4, 'e'), rest('e')]);
    expect(ofKind(sys.items, 'flag')).toHaveLength(1);
    expect(ofKind(sys.items, 'rest')).toHaveLength(1);
  });

  it('moves the dot into the space above a note on a line', () => {
    const sys = build([note('E', 4, 'h', true)]);
    const [dot] = ofKind(sys.items, 'dot');
    expect(dot.y).toBeCloseTo(TOP + 4 * S - S / 2);
  });

  it('puts the dot of a dotted rest clear of the rest glyph', () => {
    const half = build([rest('h', true), rest('q')]);
    expect(ofKind(half.items, 'dot')[0].x).toBeCloseTo(ofKind(half.items, 'rest')[0].x + 1.05 * S);
    const quarter = build([rest('q', true), rest('e')]);
    expect(ofKind(quarter.items, 'dot')[0].x).toBeCloseTo(
      ofKind(quarter.items, 'rest')[0].x + 0.8 * S,
    );
  });

  it('shows a lone full-measure rest as a centered whole rest without a dot, even in 3/4', () => {
    const sys = build([rest('h', true), note('C', 4, 'q'), rest('h')], {}, false, '3/4');
    const rests = ofKind(sys.items, 'rest');
    const bars = ofKind(sys.items, 'barLine');
    expect(rests[0]).toMatchObject({ duration: 'w', eventIndex: 0 });
    expect(rests[0].x).toBeCloseTo((sys.startX + bars[0].x) / 2);
    expect(ofKind(sys.items, 'dot')).toHaveLength(0);
    // a rest that shares its measure keeps its own glyph and position
    expect(rests[1]).toMatchObject({ duration: 'h', eventIndex: 2 });
    expect(rests[1].x).toBeCloseTo(sys.slots[2].x + METRICS.noteLead * S);
  });

  it('centres a whole rest that fills a 4/4 measure', () => {
    const sys = build([rest('w')]);
    const [r] = ofKind(sys.items, 'rest');
    const [bar] = ofKind(sys.items, 'barLine');
    expect(r.duration).toBe('w');
    expect(r.x).toBeCloseTo((sys.startX + bar.x) / 2);
  });

  it('labels notes by letter, solfège, or not at all', () => {
    expect(ofKind(build([note('G', 4, 'q')]).items, 'label').map((l) => l.text)).toEqual(['G']);
    expect(
      ofKind(build([note('G', 4, 'q')], { noteLabels: 'solfege' }).items, 'label').map(
        (l) => l.text,
      ),
    ).toEqual(['Sol']);
    expect(ofKind(build([note('G', 4, 'q')], { noteLabels: 'none' }).items, 'label')).toHaveLength(
      0,
    );
  });

  it('scales fruit by duration when sizeByDuration is on', () => {
    const sys = build([note('C', 5, 'h'), note('C', 5, 'q')], { sizeByDuration: true });
    const [half, quarter] = ofKind(sys.items, 'fruit');
    expect(half.size / quarter.size).toBeCloseTo(1.15);
  });

  it('records one slot per event in order', () => {
    const sys = build([note('C', 4, 'q'), rest('q'), note('D', 4, 'h')]);
    expect(sys.slots.map((s) => s.eventIndex)).toEqual([0, 1, 2]);
    expect(sys.slots[1].x).toBeGreaterThan(sys.slots[0].x);
  });

  it('stretches a justified system to the right edge and marks the final bar', () => {
    const sys = build([note('C', 4, 'w')], {}, true);
    const bars = ofKind(sys.items, 'barLine');
    expect(bars).toHaveLength(1);
    expect(bars[0].final).toBe(true);
    expect(bars[0].x).toBeCloseTo(10 + 300 - METRICS.systemEndPadding * S);
  });
});
