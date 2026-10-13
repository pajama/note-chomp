import { MAX_TITLE_LENGTH, validateSong } from '../core/model/schema';
import { splitIntoMeasures } from '../core/theory/rhythm';
import { dottedEighthError } from './importHelpers';
import type { IssueCollector } from './issues';
import type { ImportResult } from './types';

export const TITLE_SHORTENED_WARNING = `The title was shortened to ${MAX_TITLE_LENGTH} characters.`;

/** A title from someone else's file shouldn't sink the whole import: cut it down to size. */
function shortenTitle(draft: unknown, issues: IssueCollector): unknown {
  if (typeof draft !== 'object' || draft === null || !('title' in draft)) return draft;
  const { title } = draft;
  if (typeof title !== 'string' || title.trim().length <= MAX_TITLE_LENGTH) return draft;
  issues.warn(TITLE_SHORTENED_WARNING);
  return { ...draft, title: title.trim().slice(0, MAX_TITLE_LENGTH).trimEnd() };
}

export function finalizeImport(draft: unknown, issues: IssueCollector): ImportResult {
  if (issues.hasErrors) return { ok: false, errors: issues.errors };
  const validated = validateSong(shortenTitle(draft, issues));
  if (!validated.ok) {
    return { ok: false, errors: validated.error.map((issue) => ({ message: issue.message })) };
  }
  const song = validated.value;
  // Dotted eighths are valid in the model but not supported (Global Constraint 13): every
  // importer rejects them, including Note Chomp's own JSON.
  const measures = splitIntoMeasures(song.events, song.timeSignature);
  if (measures.ok) {
    for (const measure of measures.value) {
      for (const { event } of measure.events) {
        if (event.duration === 'e' && event.dotted) {
          issues.error(dottedEighthError(measure.number, event.kind));
        }
      }
    }
  }
  if (issues.hasErrors) return { ok: false, errors: issues.errors };
  // A file with only rests is as empty as one with nothing in it.
  if (!song.events.some((event) => event.kind === 'note')) {
    return { ok: false, errors: [{ message: 'No notes were found in this file.' }] };
  }
  return { ok: true, song, warnings: issues.warnings };
}
