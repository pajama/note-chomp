import type { MusicEvent } from '../model/types';
import { durationName } from '../theory/rhythm';

export interface DescribeFlags {
  selected?: boolean;
  playing?: boolean;
}

/** Screen-reader name for event `index`: "Note 3: G, quarter note", "Note 4: half rest, selected". */
export function describeEvent(event: MusicEvent, index: number, flags: DescribeFlags = {}): string {
  const what =
    event.kind === 'note' ? `${event.pitch}, ${durationName(event)}` : durationName(event);
  const extras = [flags.selected ? 'selected' : '', flags.playing ? 'playing' : ''].filter(Boolean);
  return [`Note ${index + 1}: ${what}`, ...extras].join(', ');
}
