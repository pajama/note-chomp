import type { Song } from '../core/model/types';

export interface ImportIssue {
  message: string;
}

export type ImportResult =
  { ok: true; song: Song; warnings: ImportIssue[] } | { ok: false; errors: ImportIssue[] };

export function importFailure(messages: string[]): ImportResult {
  return { ok: false, errors: messages.map((message) => ({ message })) };
}
