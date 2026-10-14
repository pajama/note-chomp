import { describeEvent } from '../core/editor/describe';
import type { MusicEvent } from '../core/model/types';

/** What the sheet should keep in view: the playing note, else the selected note, else the cursor. */
export function scrollAnchorSelector(playing: number | null, selection: number | null): string {
  const index = playing ?? selection;
  return index === null
    ? '[data-kind="cursor"]'
    : `[data-kind="note-target"][data-event-index="${index}"]`;
}

/** Text for the polite live region when the selection changes. */
export function selectionAnnouncement(events: MusicEvent[], selection: number | null): string {
  const event = selection === null ? undefined : events[selection];
  return event && selection !== null ? `Selected ${describeEvent(event, selection)}` : '';
}
