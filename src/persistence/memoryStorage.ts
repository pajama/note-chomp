import type { KeyValueStorage } from './SongRepository';

export class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** localStorage when usable (not blocked/private mode), otherwise an in-memory fallback. */
export function safeLocalStorage(): KeyValueStorage {
  try {
    const storage = window.localStorage;
    const probe = '__notechomp_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStorage();
  }
}
