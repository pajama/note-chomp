import { useState, type ChangeEvent } from 'react';
import { importSong, type ImportSource } from '../../formats/importSong';
import type { ImportResult } from '../../formats/types';
import { SongPages } from '../components/SongPages';
import { navigate } from '../router';
import { messageOf, useSongLibrary } from '../useSongLibrary';

const PLACEHOLDER = 'X:1\nT:Hot Cross Buns\nM:4/4\nL:1/4\nK:C\nE D C2 | E D C2 |]';

export function ImportPage() {
  const library = useSongLibrary();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const run = (source: ImportSource) => {
    setSaveError(null);
    setResult(importSong(source));
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    run({ kind: 'file', name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    input.value = '';
  };

  const saveAnd = async (next: 'songbook' | 'edit' | 'print') => {
    if (!result?.ok) return;
    try {
      const saved = await library.save(result.song);
      navigate(next === 'songbook' ? { name: 'songbook' } : { name: next, id: saved.id });
    } catch (e) {
      setSaveError(messageOf(e));
    }
  };

  return (
    <div className="import">
      <section className="panel">
        <h1>Import a song</h1>
        <p>
          Paste ABC notation, MusicXML, or a Note Chomp file — or choose a file (.abc, .musicxml,
          .xml, .mxl, .json).
        </p>
        <textarea
          aria-label="Song text"
          rows={10}
          style={{ width: '100%', fontFamily: 'ui-monospace, monospace' }}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="toolbar">
          <button type="button" disabled={!text.trim()} onClick={() => run({ kind: 'text', text })}>
            Import text
          </button>
          <label className="button secondary">
            Choose a file
            <input
              type="file"
              accept=".abc,.musicxml,.xml,.mxl,.json"
              hidden
              onChange={(e) => void onFile(e)}
            />
          </label>
        </div>
      </section>

      {result && !result.ok && (
        <div className="alert error" role="alert">
          <strong>We couldn't import that song:</strong>
          <ul>
            {result.errors.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {result?.ok && (
        <section className="panel">
          <h2>{result.song.title}</h2>
          {result.warnings.length > 0 && (
            <div className="alert" role="status">
              <strong>Heads up:</strong>
              <ul>
                {result.warnings.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          {saveError && (
            <p className="alert error" role="alert">
              {saveError}
            </p>
          )}
          <div className="toolbar">
            <button type="button" onClick={() => void saveAnd('songbook')}>
              Save to my songs
            </button>
            <button type="button" className="secondary" onClick={() => void saveAnd('edit')}>
              Save and edit
            </button>
            <button type="button" className="secondary" onClick={() => void saveAnd('print')}>
              Save and print
            </button>
          </div>
          <SongPages song={result.song} />
        </section>
      )}
    </div>
  );
}
