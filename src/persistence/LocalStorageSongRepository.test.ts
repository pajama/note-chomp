import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import type { Song } from '../core/model/types';
import { LocalStorageSongRepository } from './LocalStorageSongRepository';
import { MemoryStorage } from './memoryStorage';
import { SongValidationError, STORAGE_KEYS } from './SongRepository';

const NOW = new Date('2026-10-13T12:00:00Z');
const song = (id: string, title = 'Song'): Song => ({
  ...createEmptySong(title),
  id,
  events: [note('C', 4, 'q')],
});

function setup() {
  const storage = new MemoryStorage();
  return { storage, repo: new LocalStorageSongRepository(storage, () => NOW) };
}

describe('LocalStorageSongRepository', () => {
  it('starts empty', async () => {
    expect(await setup().repo.list()).toEqual([]);
  });

  it('saves, gets, and lists songs in insertion order', async () => {
    const { repo } = setup();
    await repo.save(song('a', 'First'));
    await repo.save(song('b', 'Second'));
    expect((await repo.list()).map((s) => s.title)).toEqual(['First', 'Second']);
    expect((await repo.get('b'))?.title).toBe('Second');
    expect(await repo.get('zzz')).toBeUndefined();
  });

  it('updates an existing song in place', async () => {
    const { repo } = setup();
    await repo.save(song('a', 'First'));
    await repo.save(song('b', 'Second'));
    await repo.save(song('a', 'Renamed'));
    expect((await repo.list()).map((s) => s.title)).toEqual(['Renamed', 'Second']);
  });

  it('returns the normalized song from save', async () => {
    const saved = await setup().repo.save(song('a', '  Spaces  '));
    expect(saved.title).toBe('Spaces');
  });

  it('refuses to save an invalid song', async () => {
    const { repo } = setup();
    await expect(repo.save({ ...song('a'), title: '' })).rejects.toBeInstanceOf(
      SongValidationError,
    );
    expect(await repo.list()).toEqual([]);
  });

  it('removes songs', async () => {
    const { repo } = setup();
    await repo.save(song('a'));
    await repo.remove('a');
    expect(await repo.list()).toEqual([]);
  });

  it('quarantines an unreadable store instead of crashing', async () => {
    const { storage, repo } = setup();
    storage.setItem(STORAGE_KEYS.songs, '{not json');
    expect(await repo.list()).toEqual([]);
    expect(storage.getItem(STORAGE_KEYS.songs)).toBeNull();
    const quarantine = JSON.parse(storage.getItem(STORAGE_KEYS.quarantine) ?? '[]');
    expect(quarantine).toEqual([
      { at: NOW.toISOString(), reason: 'unreadable JSON', data: '{not json' },
    ]);
  });

  it('quarantines invalid records and keeps the valid ones', async () => {
    const { storage, repo } = setup();
    const bad = { ...song('bad'), events: [note('F', 3, 'q')] };
    storage.setItem(STORAGE_KEYS.songs, JSON.stringify({ version: 1, songs: [song('ok'), bad] }));
    expect((await repo.list()).map((s) => s.id)).toEqual(['ok']);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.songs) ?? '').songs).toHaveLength(1);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.quarantine) ?? '[]')[0].data.id).toBe('bad');
  });

  it('quarantines an unknown envelope', async () => {
    const { storage, repo } = setup();
    storage.setItem(STORAGE_KEYS.songs, JSON.stringify([song('a')]));
    expect(await repo.list()).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.quarantine) ?? '[]')[0].reason).toBe(
      'unknown format',
    );
  });
});
