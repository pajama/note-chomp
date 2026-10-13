import { validateSong } from '../core/model/schema';
import type { Song } from '../core/model/types';
import {
  SongValidationError,
  STORAGE_KEYS,
  type KeyValueStorage,
  type SongRepository,
} from './SongRepository';

interface Envelope {
  version: 1;
  songs: unknown[];
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { songs?: unknown }).songs)
  );
}

export class LocalStorageSongRepository implements SongRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<Song[]> {
    return this.read();
  }

  async get(id: string): Promise<Song | undefined> {
    return this.read().find((song) => song.id === id);
  }

  async save(song: Song): Promise<Song> {
    const validated = validateSong(song);
    if (!validated.ok) throw new SongValidationError(validated.error);
    const songs = this.read();
    const index = songs.findIndex((s) => s.id === validated.value.id);
    if (index === -1) songs.push(validated.value);
    else songs[index] = validated.value;
    this.write(songs);
    return validated.value;
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((song) => song.id !== id));
  }

  private read(): Song[] {
    const raw = this.storage.getItem(STORAGE_KEYS.songs);
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.quarantine(raw, 'unreadable JSON');
      this.storage.removeItem(STORAGE_KEYS.songs);
      return [];
    }
    if (!isEnvelope(parsed)) {
      this.quarantine(parsed, 'unknown format');
      this.storage.removeItem(STORAGE_KEYS.songs);
      return [];
    }
    const songs: Song[] = [];
    let dropped = false;
    for (const entry of parsed.songs) {
      const validated = validateSong(entry);
      if (validated.ok) songs.push(validated.value);
      else {
        this.quarantine(entry, validated.error.map((issue) => issue.message).join(' '));
        dropped = true;
      }
    }
    if (dropped) this.write(songs);
    return songs;
  }

  private write(songs: Song[]): void {
    const envelope: Envelope = { version: 1, songs };
    this.storage.setItem(STORAGE_KEYS.songs, JSON.stringify(envelope));
  }

  private quarantine(data: unknown, reason: string): void {
    try {
      const existingRaw = this.storage.getItem(STORAGE_KEYS.quarantine);
      const existing: unknown = existingRaw ? JSON.parse(existingRaw) : [];
      const list = Array.isArray(existing) ? existing : [];
      list.push({ at: this.now().toISOString(), reason, data });
      this.storage.setItem(STORAGE_KEYS.quarantine, JSON.stringify(list));
    } catch {
      // Quarantine is best-effort; never let it break loading.
    }
  }
}
