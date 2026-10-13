import type { ValidationIssue } from '../core/model/schema';
import type { Song } from '../core/model/types';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const STORAGE_KEYS = {
  songs: 'notechomp:songs:v1',
  quarantine: 'notechomp:quarantine:v1',
  draft: 'notechomp:draft:v1',
} as const;

export interface SongRepository {
  list(): Promise<Song[]>;
  get(id: string): Promise<Song | undefined>;
  /** Validates, upserts, and resolves with the normalized song. Rejects with SongValidationError. */
  save(song: Song): Promise<Song>;
  remove(id: string): Promise<void>;
}

export class SongValidationError extends Error {
  override name = 'SongValidationError';
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '));
  }
}
