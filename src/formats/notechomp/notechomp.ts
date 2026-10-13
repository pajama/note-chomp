import type { Song } from '../../core/model/types';
import { finalizeImport } from '../finalize';
import { IssueCollector } from '../issues';
import { importFailure, type ImportResult } from '../types';

export const NOTECHOMP_EXTENSION = '.notechomp.json';

export function serializeSong(song: Song): string {
  return `${JSON.stringify(song, null, 2)}\n`;
}

export function parseNoteChompJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return importFailure(["This file isn't valid Note Chomp JSON."]);
  }
  return finalizeImport(data, new IssueCollector());
}
