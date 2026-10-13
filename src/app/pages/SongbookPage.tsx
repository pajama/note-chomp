import { useState, type ReactNode } from 'react';
import { newSongId } from '../../core/model/id';
import type { Song } from '../../core/model/types';
import { slugify } from '../../core/text';
import { NOTECHOMP_EXTENSION, serializeSong } from '../../formats/notechomp/notechomp';
import { FruitStrip } from '../components/FruitStrip';
import { downloadText } from '../download';
import { navigate, routeToHash } from '../router';
import { messageOf, useSongLibrary } from '../useSongLibrary';

function SongCard({ song, actions }: { song: Song; actions: ReactNode }) {
  const noteCount = song.events.filter((e) => e.kind === 'note').length;
  return (
    <article className="panel song-card" data-testid="song-card">
      <h3>{song.title}</h3>
      <FruitStrip song={song} />
      <p className="muted">
        {song.timeSignature} · {noteCount} notes
      </p>
      <div className="actions">{actions}</div>
    </article>
  );
}

export function SongbookPage() {
  const library = useSongLibrary();
  const [error, setError] = useState<string | null>(null);

  const copy = async (song: Song) => {
    try {
      const saved = await library.save({
        ...song,
        id: newSongId(),
        title: `${song.title} (my copy)`,
      });
      navigate({ name: 'edit', id: saved.id });
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const remove = async (song: Song) => {
    if (!window.confirm(`Delete "${song.title}"? This can't be undone.`)) return;
    try {
      await library.remove(song.id);
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const exportJson = (song: Song) =>
    downloadText(
      `${slugify(song.title)}${NOTECHOMP_EXTENSION}`,
      serializeSong(song),
      'application/json',
    );

  return (
    <div className="songbook">
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {library.status === 'error' && (
        <p className="alert error" role="alert">
          Couldn't load your songs: {library.error}
        </p>
      )}

      <section>
        <h2>My songs</h2>
        {library.status === 'loading' ? (
          <p>Loading…</p>
        ) : library.user.length === 0 ? (
          <p className="panel">
            No songs yet. <a href="#/new">Make one</a>, <a href="#/import">import one</a>, or copy a
            starter song below.
          </p>
        ) : (
          <div className="song-grid">
            {library.user.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                actions={
                  <>
                    <a className="button" href={routeToHash({ name: 'print', id: song.id })}>
                      Print
                    </a>
                    <a
                      className="button secondary"
                      href={routeToHash({ name: 'edit', id: song.id })}
                    >
                      Edit
                    </a>
                    <button type="button" className="secondary" onClick={() => exportJson(song)}>
                      Export
                    </button>
                    <button type="button" className="danger" onClick={() => void remove(song)}>
                      Delete
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Starter songs</h2>
        <div className="song-grid">
          {library.builtin.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              actions={
                <>
                  <a className="button" href={routeToHash({ name: 'print', id: song.id })}>
                    Print
                  </a>
                  <button type="button" className="secondary" onClick={() => void copy(song)}>
                    Make a copy
                  </button>
                </>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
