import type { Note, Rest, TimeSignature } from '../model/types';
import { NEUTRAL, PALETTE } from '../palette/palette';
import { isOnLine, ledgerSteps, MIDDLE_LINE_STEP, staffStep, stemDirection } from '../theory/pitch';
import { eventUnits, measureUnits, type Measure, type PlacedEvent } from '../theory/rhythm';
import { findBeamGroups } from './beams';
import { labelItem } from './builders';
import { METRICS, stepY } from './metrics';
import type { RenderOptions } from './options';
import { eventAdvance, measureWidth } from './spacing';
import type { LayoutItem, SlotPosition, SystemLayout } from './types';

export interface SystemInput {
  index: number;
  measures: Measure[];
  timeSignature: TimeSignature;
  staffTop: number;
  left: number;
  width: number;
  spacing: number;
  options: RenderOptions;
  justify: boolean;
  isFinalSystem: boolean;
}

interface BeamInfo {
  direction: 'up' | 'down';
  tipY: number;
}

interface Placed {
  placed: PlacedEvent;
  slotX: number;
  cx: number;
}

export function layoutSystem(input: SystemInput): SystemLayout {
  const { measures, staffTop, left, width, spacing: s, options } = input;
  const items: LayoutItem[] = [];
  const slots: SlotPosition[] = [];
  const y = (step: number) => stepY(staffTop, s, step);

  items.push({
    kind: 'staff',
    x: left,
    y: staffTop,
    width,
    spacing: s,
    lineWidth: METRICS.staffLineWidth * s,
  });

  const monsterWidth = METRICS.monsterWidth * s;
  const monsterHeight = METRICS.monsterHeight * s;
  items.push({
    kind: 'monster',
    x: left,
    y: y(MIDDLE_LINE_STEP) - monsterHeight / 2,
    width: monsterWidth,
    height: monsterHeight,
  });

  let x = left + monsterWidth + METRICS.monsterGap * s;
  if (options.showTrebleClef) {
    items.push({ kind: 'clef', x, y: y(2), spacing: s });
    x += METRICS.clefWidth * s;
  }
  if (options.showMeasureNumbers && measures.length > 0) {
    items.push(
      labelItem(
        String(measures[0].number),
        x,
        staffTop - 0.8 * s,
        METRICS.measureNumberFontSize * s,
        NEUTRAL.ink,
        'start',
        'normal',
      ),
    );
  }

  const startX = x;
  const natural = measures.reduce((sum, m) => sum + measureWidth(m), 0);
  const available = (left + width - x) / s - METRICS.systemEndPadding;
  const stretch = natural > 0 && (input.justify || natural > available) ? available / natural : 1;

  const capacity = measureUnits(input.timeSignature);

  measures.forEach((measure, measureIndex) => {
    const measureStartX = x;
    x += METRICS.barPadding * s * stretch;

    const placedEvents: Placed[] = measure.events.map((placed) => {
      const slotX = x;
      x += eventAdvance(placed.event) * s * stretch;
      return { placed, slotX, cx: slotX + METRICS.noteLead * s };
    });
    x += METRICS.measureEndPadding * s * stretch;
    const wholeBarRest = isWholeBarRest(measure, capacity);

    const beams = new Map<number, BeamInfo>();
    for (const group of findBeamGroups(measure)) {
      const members = placedEvents.filter((p) => group.includes(p.placed.index));
      const notes = members.map((p) => p.placed.event as Note);
      const steps = notes.map((n) => staffStep(n.pitch, n.octave));
      const direction = beamDirection(steps);
      const tipY =
        direction === 'up'
          ? Math.min(...steps.map((st) => y(st) - stemLengthFor(st, y, s)))
          : Math.max(...steps.map((st) => y(st) + stemLengthFor(st, y, s)));
      const stemXs = members.map((p, i) => stemX(p.cx, direction, fruitSize(notes[i], s, options)));
      const pitches = new Set(notes.map((n) => n.pitch));
      const color = pitches.size === 1 ? PALETTE[notes[0].pitch].stroke : NEUTRAL.ink;
      const half = (METRICS.stemWidth * s) / 2;
      items.push({
        kind: 'beam',
        x1: stemXs[0] - half,
        y1: tipY,
        x2: stemXs[stemXs.length - 1] + half,
        y2: tipY,
        thickness: METRICS.beamThickness * s,
        color,
        direction,
      });
      members.forEach((p) => beams.set(p.placed.index, { direction, tipY }));
    }

    for (const p of placedEvents) {
      slots.push({ eventIndex: p.placed.index, x: p.slotX });
      const event = p.placed.event;
      if (event.kind === 'note') {
        items.push(
          ...noteItems(
            event,
            p.placed.index,
            p.cx,
            y,
            staffTop,
            s,
            options,
            beams.get(p.placed.index),
          ),
        );
      } else if (wholeBarRest) {
        items.push(wholeBarRestItem(p.placed.index, (measureStartX + x) / 2, y, s));
      } else {
        items.push(...restItems(event, p.placed.index, p.cx, y, s));
      }
    }

    items.push({
      kind: 'barLine',
      x,
      y1: staffTop,
      y2: staffTop + 4 * s,
      final: input.isFinalSystem && measureIndex === measures.length - 1,
      width: METRICS.barLineWidth * s,
    });
  });

  return {
    index: input.index,
    staffTop,
    firstMeasure: measures[0]?.number ?? 1,
    startX,
    endX: x,
    items,
    slots,
  };
}

/** The note farthest from the middle line decides; a tie (or a note on the line) points down. */
function beamDirection(steps: number[]): 'up' | 'down' {
  const distance = (st: number) => Math.abs(st - MIDDLE_LINE_STEP);
  const farthest = Math.max(...steps.map(distance));
  return steps.filter((st) => distance(st) === farthest).every((st) => st < MIDDLE_LINE_STEP)
    ? 'up'
    : 'down';
}

/** Normal stem length, but always long enough to reach the middle line (far ledger notes). */
function stemLengthFor(step: number, y: (step: number) => number, s: number): number {
  return Math.max(METRICS.stemLength * s, Math.abs(y(step) - y(MIDDLE_LINE_STEP)));
}

/** A measure holding nothing but one rest that lasts the whole measure. */
function isWholeBarRest(measure: Measure, capacity: number): boolean {
  if (measure.events.length !== 1) return false;
  const only = measure.events[0].event;
  return only.kind === 'rest' && eventUnits(only) === capacity;
}

function fruitSize(note: Note, s: number, options: RenderOptions): number {
  const scale = options.sizeByDuration ? METRICS.sizeByDurationScale[note.duration] : 1;
  return METRICS.fruitSize * s * scale;
}

function stemX(cx: number, direction: 'up' | 'down', size: number): number {
  return direction === 'up' ? cx + size * 0.42 : cx - size * 0.42;
}

function noteItems(
  note: Note,
  eventIndex: number,
  cx: number,
  y: (step: number) => number,
  staffTop: number,
  s: number,
  options: RenderOptions,
  beam: BeamInfo | undefined,
): LayoutItem[] {
  const out: LayoutItem[] = [];
  const step = staffStep(note.pitch, note.octave);
  const ny = y(step);
  const size = fruitSize(note, s, options);
  const entry = PALETTE[note.pitch];

  const ledgerHalf = (METRICS.fruitSize * s) / 2 + METRICS.ledgerExtension * s;
  for (const ledger of ledgerSteps(step)) {
    out.push({
      kind: 'ledger',
      x1: cx - ledgerHalf,
      x2: cx + ledgerHalf,
      y: y(ledger),
      width: METRICS.ledgerWidth * s,
    });
  }

  if (note.duration !== 'w') {
    const direction = beam?.direction ?? stemDirection(step);
    const sx = stemX(cx, direction, size);
    const length = stemLengthFor(step, y, s);
    const tip = beam?.tipY ?? (direction === 'up' ? ny - length : ny + length);
    out.push({
      kind: 'stem',
      x: sx,
      y1: ny,
      y2: tip,
      width: METRICS.stemWidth * s,
      color: entry.stroke,
    });
    if (note.duration === 'e' && !beam) {
      out.push({
        kind: 'flag',
        x: sx,
        y: tip,
        direction,
        size: METRICS.flagSize * s,
        color: entry.stroke,
      });
    }
  }

  out.push({
    kind: 'fruit',
    pitch: note.pitch,
    octave: note.octave,
    x: cx,
    y: ny,
    size,
    hollow: note.duration === 'h' || note.duration === 'w',
    eventIndex,
  });

  if (note.dotted) {
    out.push({
      kind: 'dot',
      x: cx + size / 2 + METRICS.dotGap * s,
      y: isOnLine(step) ? ny - s / 2 : ny,
      r: METRICS.dotRadius * s,
      color: entry.stroke,
    });
  }

  if (options.noteLabels !== 'none') {
    out.push(
      labelItem(
        options.noteLabels === 'letter' ? note.pitch : entry.solfege,
        cx,
        staffTop + 4 * s + METRICS.labelBaselineBelow * s,
        METRICS.labelFontSize * s,
        entry.stroke,
        'middle',
        'bold',
      ),
    );
  }
  return out;
}

function restItems(
  rest: Rest,
  eventIndex: number,
  cx: number,
  y: (step: number) => number,
  s: number,
): LayoutItem[] {
  const out: LayoutItem[] = [
    {
      kind: 'rest',
      duration: rest.duration,
      x: cx,
      y: y(MIDDLE_LINE_STEP),
      spacing: s,
      eventIndex,
    },
  ];
  if (rest.dotted) {
    // half/whole rests are wide blocks; keep the dot clear of them
    const offset = rest.duration === 'h' || rest.duration === 'w' ? 1.05 : 0.8;
    out.push({
      kind: 'dot',
      x: cx + offset * s,
      y: y(MIDDLE_LINE_STEP + 1),
      r: METRICS.dotRadius * s,
      color: NEUTRAL.ink,
    });
  }
  return out;
}

/** Whole-measure rest: the whole-rest glyph centered in the measure, never dotted. */
function wholeBarRestItem(
  eventIndex: number,
  centerX: number,
  y: (step: number) => number,
  s: number,
): LayoutItem {
  return {
    kind: 'rest',
    duration: 'w',
    x: centerX,
    y: y(MIDDLE_LINE_STEP),
    spacing: s,
    eventIndex,
  };
}
