import { useCallback, useEffect, useState } from 'react';
import type { Song } from '../core/model/types';
import { BUNDLED_SONGS } from '../songs';
import { useServices } from './services';

export interface LibraryEntry {
  song: Song;
  builtin: boolean;
}

export interface SongLibrary {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  builtin: Song[];
  user: Song[];
  find(id: string): LibraryEntry | undefined;
  save(song: Song): Promise<Song>;
  remove(id: string): Promise<void>;
}

export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function useSongLibrary(): SongLibrary {
  const { repository } = useServices();
  const [user, setUser] = useState<Song[]>([]);
  const [status, setStatus] = useState<SongLibrary['status']>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository.list().then(
      (songs) => {
        if (cancelled) return;
        setUser(songs);
        setStatus('ready');
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(messageOf(e));
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const save = useCallback(
    async (song: Song) => {
      const saved = await repository.save(song);
      setUser(await repository.list());
      return saved;
    },
    [repository],
  );

  const remove = useCallback(
    async (id: string) => {
      await repository.remove(id);
      setUser(await repository.list());
    },
    [repository],
  );

  const find = useCallback(
    (id: string): LibraryEntry | undefined => {
      const builtin = BUNDLED_SONGS.find((s) => s.id === id);
      if (builtin) return { song: builtin, builtin: true };
      const mine = user.find((s) => s.id === id);
      return mine ? { song: mine, builtin: false } : undefined;
    },
    [user],
  );

  return { status, error, builtin: BUNDLED_SONGS, user, find, save, remove };
}
