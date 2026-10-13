import { useState } from 'react';
import {
  DEFAULT_RENDER_OPTIONS,
  layoutSong,
  STAFF_SIZES,
  type NoteLabels,
  type Paper,
  type RenderOptions,
} from '../../core/layout';
import { downloadPdf } from '../../export/pdf/exportPdf';
import { SongPages } from '../components/SongPages';
import { routeToHash } from '../router';
import { messageOf, useSongLibrary } from '../useSongLibrary';

export function PrintPage({ songId }: { songId: string }) {
  const library = useSongLibrary();
  const [options, setOptions] = useState<RenderOptions>(DEFAULT_RENDER_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entry = library.find(songId);

  if (library.status === 'loading') return <p>Loading…</p>;
  if (!entry) {
    return (
      <section className="panel">
        <h1>Song not found</h1>
        <p>
          <a href="#/">Back to the songbook</a>
        </p>
      </section>
    );
  }
  const song = entry.song;

  const set = <K extends keyof RenderOptions>(key: K, value: RenderOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadPdf(layoutSong(song, options), song.title);
    } catch (e) {
      setError(`Couldn't make the PDF: ${messageOf(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="print">
      <div className="panel print-options no-print">
        <h1>{song.title}</h1>
        <div className="toolbar">
          <label>
            Paper{' '}
            <select value={options.paper} onChange={(e) => set('paper', e.target.value as Paper)}>
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <label>
            Staff size{' '}
            <select
              value={String(options.staffSpaceMm)}
              onChange={(e) => set('staffSpaceMm', Number(e.target.value))}
            >
              <option value={String(STAFF_SIZES.large)}>Large</option>
              <option value={String(STAFF_SIZES.jumbo)}>Jumbo</option>
            </select>
          </label>
          <label>
            Labels{' '}
            <select
              value={options.noteLabels}
              onChange={(e) => set('noteLabels', e.target.value as NoteLabels)}
            >
              <option value="letter">Letters (C D E)</option>
              <option value="solfege">Solfège (Do Re Mi)</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <div className="toolbar">
          <label>
            <input
              type="checkbox"
              checked={options.showLegend}
              onChange={(e) => set('showLegend', e.target.checked)}
            />{' '}
            Fruit legend
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.showTrebleClef}
              onChange={(e) => set('showTrebleClef', e.target.checked)}
            />{' '}
            Treble clef
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.showMeasureNumbers}
              onChange={(e) => set('showMeasureNumbers', e.target.checked)}
            />{' '}
            Measure numbers
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.sizeByDuration}
              onChange={(e) => set('sizeByDuration', e.target.checked)}
            />{' '}
            Bigger fruit for longer notes (experimental)
          </label>
        </div>
        <div className="toolbar">
          <button type="button" disabled={busy} onClick={() => void exportPdf()}>
            {busy ? 'Making PDF…' : 'Download PDF'}
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>
            Print
          </button>
          <a className="button secondary" href={routeToHash({ name: 'edit', id: song.id })}>
            {entry.builtin ? 'Edit a copy' : 'Edit'}
          </a>
        </div>
      </div>
      {error && (
        <div className="alert error no-print" role="alert">
          {error}{' '}
          <button type="button" disabled={busy} onClick={() => void exportPdf()}>
            Try again
          </button>
        </div>
      )}
      <SongPages song={song} options={options} />
    </div>
  );
}
