import { validateSong } from '../core/model/schema';
import type { IssueCollector } from './issues';
import type { ImportResult } from './types';

export function finalizeImport(draft: unknown, issues: IssueCollector): ImportResult {
  if (issues.hasErrors) return { ok: false, errors: issues.errors };
  const validated = validateSong(draft);
  if (!validated.ok) {
    return { ok: false, errors: validated.error.map((issue) => ({ message: issue.message })) };
  }
  // A file with only rests is as empty as one with nothing in it.
  if (!validated.value.events.some((event) => event.kind === 'note')) {
    return { ok: false, errors: [{ message: 'No notes were found in this file.' }] };
  }
  return { ok: true, song: validated.value, warnings: issues.warnings };
}
