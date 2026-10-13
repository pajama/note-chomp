import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { MemoryStorage } from './memoryStorage';
import { STORAGE_KEYS } from './SongRepository';

describe('draft', () => {
  it('round-trips the song being edited', () => {
    const storage = new MemoryStorage();
    const song = { ...createEmptySong('Draft'), events: [note('E', 4, 'h')] };
    saveDraft(storage, song);
    expect(loadDraft(storage)).toEqual(song);
    clearDraft(storage);
    expect(loadDraft(storage)).toBeUndefined();
  });

  it('ignores a corrupt draft', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.draft, '{"nope":true}');
    expect(loadDraft(storage)).toBeUndefined();
  });

  it('never throws when storage is full', () => {
    const full = {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(() => saveDraft(full, createEmptySong())).not.toThrow();
  });
});
