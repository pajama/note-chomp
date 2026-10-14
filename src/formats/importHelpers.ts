import { rest } from '../core/model/factories';
import type { Pitch, Rest } from '../core/model/types';
import { diatonicIndex, RANGE_LABEL } from '../core/theory/pitch';
import { fillUnits } from '../core/theory/rhythm';

/** Messages and helpers shared by the ABC and MusicXML importers. */

export const PICKUP_WARNING =
  'The tune starts with a pickup — rests were added at the start so the bar lines line up.';
export const REPEATS_WARNING =
  'Repeat signs were ignored — the music is printed once, straight through.';

export const endingsError = (m: number) =>
  `Measure ${m}: first and second endings aren't supported yet — write the tune out in full.`;

export const timeChangeError = (m: number) =>
  `Measure ${m}: time signature changes aren't supported.`;

/** "an A", "an E", "an F" (said "eff"), otherwise "a". */
const withArticle = (pitch: Pitch) => `${'AEF'.includes(pitch) ? 'an' : 'a'} ${pitch}`;

export const rangeError = (m: number, pitch: Pitch, octave: number) =>
  `Measure ${m}: ${withArticle(pitch)} that ${diatonicIndex(pitch, octave) < diatonicIndex('G', 3) ? 'low' : 'high'} ` +
  `is outside Note Chomp's range (the G below middle C up to high C, ${RANGE_LABEL}).`;

export const lengthError = (m: number, what: Pitch | 'rest') =>
  `Measure ${m}: one ${what} has a length Note Chomp can't show yet — use whole, half, quarter or eighth notes (dotted is OK).`;

export const dottedEighthError = (m: number, kind: 'note' | 'rest') =>
  `Measure ${m}: dotted eighth ${kind}s aren't supported yet.`;

/** The fewest rests (largest first) that add up to `units`, or undefined if that can't be done. */
export function fillRests(units: number): Rest[] | undefined {
  return fillUnits(units)?.map((l) => rest(l.duration, l.dotted));
}
