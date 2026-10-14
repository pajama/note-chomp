import type { Song } from '../core/model/types';

/** How the editor was opened: a blank #/new, a saved song of yours, or a fresh copy of a starter song. */
export type EditorOpening = 'new' | 'saved' | 'copy';

const sameMusic = (a: Song, b: Song) =>
  a.title === b.title &&
  a.timeSignature === b.timeSignature &&
  JSON.stringify(a.events) === JSON.stringify(b.events);

/**
 * The draft worth offering back ("Pick up where you left off?"), if any:
 * - on #/new: an unsaved song (its id isn't in your songbook) with at least one note or rest;
 * - on a saved song: that song's own draft, if it differs from what was saved;
 * - never for a fresh starter copy.
 */
export function draftToOffer(
  draft: Song | undefined,
  opened: Song,
  opening: EditorOpening,
  isSaved: (id: string) => boolean,
): Song | undefined {
  if (!draft || opening === 'copy') return undefined;
  if (opening === 'new') {
    return isSaved(draft.id) || draft.events.length === 0 ? undefined : draft;
  }
  return draft.id === opened.id && !sameMusic(draft, opened) ? draft : undefined;
}
