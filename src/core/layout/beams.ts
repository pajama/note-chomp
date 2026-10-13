import type { MusicEvent, Note } from '../model/types';
import { staffStep } from '../theory/pitch';
import { UNITS_PER_QUARTER, type Measure } from '../theory/rhythm';

const MAX_BEAM_SPAN_STEPS = 7;

function isPlainEighthNote(e: MusicEvent): e is Note {
  return e.kind === 'note' && e.duration === 'e' && !e.dotted;
}

export function findBeamGroups(measure: Measure): number[][] {
  const groups: number[][] = [];
  const events = measure.events;
  for (let i = 0; i + 1 < events.length; i++) {
    const a = events[i];
    const b = events[i + 1];
    if (!isPlainEighthNote(a.event) || !isPlainEighthNote(b.event)) continue;
    if (a.startUnit % UNITS_PER_QUARTER !== 0) continue;
    const span = Math.abs(
      staffStep(a.event.pitch, a.event.octave) - staffStep(b.event.pitch, b.event.octave),
    );
    if (span > MAX_BEAM_SPAN_STEPS) continue;
    groups.push([a.index, b.index]);
    i++;
  }
  return groups;
}
