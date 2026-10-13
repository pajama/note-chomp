import { note, rest } from '../../core/model/factories';
import {
  PITCHES,
  TIME_SIGNATURES,
  type MusicEvent,
  type Octave,
  type Pitch,
  type TimeSignature,
} from '../../core/model/types';
import { isInRange } from '../../core/theory/pitch';
import { eventUnits, formatBeats, measureUnits, unitsToDuration } from '../../core/theory/rhythm';
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

const TYPE_UNITS: Record<string, number> = { whole: 16, half: 8, quarter: 4, eighth: 2 };
const VOICES_MSG = 'This part has more than one voice. Only single-melody parts are supported.';

const childrenNamed = (el: Element, name: string) =>
  Array.from(el.children).filter((c) => c.localName === name);
const childNamed = (el: Element | undefined, name: string): Element | undefined =>
  el ? childrenNamed(el, name)[0] : undefined;
const textOf = (el: Element | undefined, name: string): string | undefined => {
  const value = childNamed(el, name)?.textContent?.trim();
  return value ? value : undefined;
};

export function parseMusicXml(xml: string): ImportResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0)
    return importFailure(["This file isn't valid MusicXML."]);
  const root = doc.documentElement;
  if (root.localName === 'score-timewise') {
    return importFailure([
      "Timewise MusicXML isn't supported — export it again as standard (partwise) MusicXML.",
    ]);
  }
  if (root.localName !== 'score-partwise')
    return importFailure(["This file isn't a MusicXML score."]);

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
      issues.error(
        `Measure ${m}: the key signature isn't C major. Only the key of C is supported for now.`,
      );
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
    if (clef && textOf(clef, 'sign') !== 'G')
      issues.warn('The music was moved to the treble clef.');
  };

  const readBarline = (el: Element, m: number) => {
    if (childNamed(el, 'ending')) issues.error(endingsError(m));
    else if (childNamed(el, 'repeat')) issues.warn(REPEATS_WARNING);
  };

  /** Reads one <note>; returns false when it was dropped without its length being counted. */
  const readNote = (el: Element, m: number): boolean => {
    if (childNamed(el, 'grace')) {
      issues.warn('Grace notes were ignored.');
      return true;
    }
    if (childNamed(el, 'cue')) return true;
    if (childNamed(el, 'chord')) {
      issues.error(`Measure ${m}: chords (several notes at once) aren't supported.`);
      return false;
    }
    const v = textOf(el, 'voice') ?? '1';
    voice ??= v;
    if (v !== voice) {
      issues.error(VOICES_MSG);
      return false;
    }
    if (childNamed(el, 'time-modification')) {
      issues.error(`Measure ${m}: triplets and other tuplets aren't supported.`);
      return false;
    }
    if (childrenNamed(el, 'tie').some((t) => t.getAttribute('type') === 'start')) {
      issues.error(`Measure ${m}: tied notes aren't supported yet.`);
      return false;
    }
    if (childNamed(el, 'lyric')) issues.warn('Lyrics were ignored.');

    const restEl = childNamed(el, 'rest');
    const pitchEl = childNamed(el, 'pitch');
    const step = textOf(pitchEl, 'step');
    const octave = Number(textOf(pitchEl, 'octave'));
    if (
      !restEl &&
      (!pitchEl || !step || !(PITCHES as readonly string[]).includes(step) || Number.isNaN(octave))
    ) {
      issues.warn(`Skipped an unpitched note in measure ${m}.`);
      return false;
    }
    const pitch = step as Pitch;
    const subject: Pitch | 'rest' = restEl ? 'rest' : pitch;

    const dots = childrenNamed(el, 'dot').length;
    if (dots > 1) {
      issues.error(`Measure ${m}: double-dotted notes aren't supported.`);
      return false;
    }

    const type = textOf(el, 'type');
    // A whole-measure rest fills the bar whatever its <type> says (Finale/MuseScore write type "whole" in 3/4).
    const measureRest =
      restEl !== undefined &&
      (restEl.getAttribute('measure') === 'yes' ||
        (type === 'whole' && (timeSignature ?? '4/4') !== '4/4'));
    let units: number;
    if (type && !measureRest) {
      const base = TYPE_UNITS[type];
      if (base === undefined) {
        issues.error(lengthError(m, subject));
        return false;
      }
      units = dots ? base * 1.5 : base;
    } else {
      units = (Number(textOf(el, 'duration') ?? '0') / divisions) * 4;
    }
    const d = unitsToDuration(units);
    if (!d) {
      issues.error(lengthError(m, subject));
      return false;
    }
    if (d.duration === 'e' && d.dotted) {
      issues.error(dottedEighthError(m, restEl ? 'rest' : 'note'));
      return false;
    }

    if (restEl) {
      events.push(rest(d.duration, d.dotted));
      return true;
    }
    const alter = Number(textOf(pitchEl, 'alter') ?? '0');
    if (alter !== 0) {
      issues.error(
        `Measure ${m}: ${pitch}${alter > 0 ? '♯' : '♭'} isn't in the key of C. Only white keys are supported for now.`,
      );
      return false;
    }
    if (!isInRange(pitch, octave)) {
      issues.error(rangeError(m, pitch, octave));
      return false;
    }
    events.push(note(pitch, octave as Octave, d.duration, d.dotted));
    return true;
  };

  const measures = childrenNamed(parts[0], 'measure');
  const bars: { measure: number; units: number; known: boolean; implicit: boolean }[] = [];
  measures.forEach((measureEl, index) => {
    const m = index + 1;
    const startEvent = events.length;
    let known = true;
    for (const el of Array.from(measureEl.children)) {
      switch (el.localName) {
        case 'attributes':
          readAttributes(el, m);
          break;
        case 'backup':
        case 'forward':
          issues.error(VOICES_MSG);
          known = false;
          break;
        case 'barline':
          readBarline(el, m);
          break;
        case 'direction':
          issues.warn('Dynamics, tempo and text directions were ignored.');
          break;
        case 'harmony':
          issues.warn('Chord symbols were ignored.');
          break;
        case 'note':
          if (!readNote(el, m)) known = false;
          break;
        default:
          break;
      }
    }
    bars.push({
      measure: m,
      units: events.slice(startEvent).reduce((sum, e) => sum + eventUnits(e), 0),
      known,
      implicit: measureEl.getAttribute('implicit') === 'yes',
    });
  });

  if (!timeSignature) issues.warn('No time signature was found — using 4/4.');
  const meter = timeSignature ?? '4/4';
  const full = measureUnits(meter);

  // Every measure except the last must be full. A short first measure is a pickup, and a short
  // measure followed by an implicit one is a single bar split in two (usually by a repeat sign).
  for (let k = 0; k < bars.length; k++) {
    const bar = bars[k];
    let units = bar.units;
    let known = bar.known;
    const next = bars[k + 1];
    if (k > 0 && units < full && next?.implicit) {
      units += next.units;
      known &&= next.known;
      k++;
    }
    if (!known || k === bars.length - 1 || units === full) continue;
    if (bar === bars[0] && units < full) continue;
    issues.error(
      `Measure ${bar.measure}: this measure has ${formatBeats(units)} but ${meter} needs ${formatBeats(full)}.`,
    );
  }

  // A short first measure is a pickup: put rests in front so the bar lines line up.
  const pickupUnits = bars[0]?.units ?? 0;
  if (bars.length > 1 && bars[0].known && pickupUnits > 0 && pickupUnits < full) {
    const padding = fillRests(full - pickupUnits);
    if (padding) {
      events.unshift(...padding);
      issues.warn(PICKUP_WARNING);
    }
  }

  return finalizeImport(
    {
      schemaVersion: 1,
      id: 'imported',
      title: title ?? 'Untitled Song',
      timeSignature: meter,
      events,
    },
    issues,
  );
}
