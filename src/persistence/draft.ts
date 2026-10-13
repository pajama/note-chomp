import { validateSong } from '../core/model/schema';
import type { Song } from '../core/model/types';
import { STORAGE_KEYS, type KeyValueStorage } from './SongRepository';

export function saveDraft(storage: KeyValueStorage, song: Song): void {
  try {
    storage.setItem(STORAGE_KEYS.draft, JSON.stringify(song));
  } catch {
    // Drafts are best-effort crash insurance.
  }
}

export function loadDraft(storage: KeyValueStorage): Song | undefined {
  try {
    const raw = storage.getItem(STORAGE_KEYS.draft);
    if (!raw) return undefined;
    const validated = validateSong(JSON.parse(raw));
    return validated.ok ? validated.value : undefined;
  } catch {
    return undefined;
  }
}

export function clearDraft(storage: KeyValueStorage): void {
  try {
    storage.removeItem(STORAGE_KEYS.draft);
  } catch {
    // ignore
  }
}
