import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createEditorState, editorReducer } from '../../core/editor/editorReducer';
import { createEmptySong } from '../../core/model/factories';
import { newSongId } from '../../core/model/id';
import { TIME_SIGNATURES, type Song, type TimeSignature } from '../../core/model/types';
import { clearDraft, saveDraft } from '../../persistence/draft';
import { DurationPicker } from '../components/DurationPicker';
import { FruitKeyboard } from '../components/FruitKeyboard';
import { SongPages } from '../components/SongPages';
import { useEditorKeyboard } from '../hooks/useEditorKeyboard';
import { navigate, setNavigationGuard } from '../router';
import { useServices } from '../services';
import { messageOf, useSongLibrary, type SongLibrary } from '../useSongLibrary';

export const LEAVE_UNSAVED_MESSAGE = 'Your song is not saved yet. Leave without saving it?';

interface EditorPageProps {
  songId?: string;
  /** Called when a save gives the song an address of its own, just before going there. */
  onSavedAs?: (id: string) => void;
}

export function EditorPage({ songId, onSavedAs }: EditorPageProps) {
  const library = useSongLibrary();
  if (songId === undefined)
    return (
      <EditorWorkspace initialSong={createEmptySong()} library={library} onSavedAs={onSavedAs} />
    );
  if (library.status === 'loading') return <p>Loading…</p>;
  const entry = library.find(songId);
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
  const initial = entry.builtin
    ? { ...entry.song, id: newSongId(), title: `${entry.song.title} (my copy)` }
    : entry.song;
  return <EditorWorkspace initialSong={initial} library={library} onSavedAs={onSavedAs} />;
}

function EditorWorkspace({
  initialSong,
  library,
  onSavedAs,
}: {
  initialSong: Song;
  library: SongLibrary;
  onSavedAs?: (id: string) => void;
}) {
  const { storage } = useServices();
  const [state, dispatch] = useReducer(editorReducer, initialSong, createEditorState);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEditorKeyboard(dispatch);

  useEffect(() => {
    if (state.dirty) saveDraft(storage, state.song);
  }, [state.song, state.dirty, storage]);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  // Leaving inside the app (header links, Back, #/ links) is a hash change, not an unload.
  // A ref, so a save can clear it before its own navigation without waiting for a re-render.
  const dirtyRef = useRef(state.dirty);
  useLayoutEffect(() => {
    dirtyRef.current = state.dirty;
  }, [state.dirty]);
  useEffect(
    () => setNavigationGuard(() => !dirtyRef.current || window.confirm(LEAVE_UNSAVED_MESSAGE)),
    [],
  );

  const save = async (): Promise<Song | undefined> => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await library.save(state.song);
      dispatch({ type: 'markSaved' });
      dirtyRef.current = false;
      clearDraft(storage);
      return saved;
    } catch (e) {
      setSaveError(messageOf(e));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    const saved = await save();
    if (!saved) return;
    onSavedAs?.(saved.id);
    navigate({ name: 'edit', id: saved.id });
  };

  const onPrint = async () => {
    const needsSave = state.dirty || library.find(state.song.id) === undefined;
    const saved = needsSave ? await save() : state.song;
    if (saved) navigate({ name: 'print', id: saved.id });
  };

  const message = state.error ?? saveError;

  return (
    <div className="editor">
      <div className="toolbar no-print">
        <input
          type="text"
          aria-label="Song title"
          maxLength={100}
          value={state.song.title}
          onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
        />
        <select
          aria-label="Time signature"
          value={state.song.timeSignature}
          onChange={(e) =>
            dispatch({ type: 'setTimeSignature', timeSignature: e.target.value as TimeSignature })
          }
        >
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts} value={ts}>
              {ts}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary"
          disabled={state.past.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
        >
          Undo
        </button>
        <button
          type="button"
          className="secondary"
          disabled={state.future.length === 0}
          onClick={() => dispatch({ type: 'redo' })}
        >
          Redo
        </button>
        <button type="button" disabled={saving} onClick={() => void onSave()}>
          {state.dirty || library.find(state.song.id) === undefined ? 'Save' : 'Saved'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={saving || state.song.events.length === 0}
          onClick={() => void onPrint()}
        >
          Print
        </button>
      </div>

      {message && (
        <div className="alert error" role="alert">
          {message}{' '}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              dispatch({ type: 'dismissError' });
              setSaveError(null);
            }}
          >
            OK
          </button>
        </div>
      )}

      <div className="panel editor-controls no-print">
        <DurationPicker
          duration={state.duration}
          dotted={state.dotted}
          timeSignature={state.song.timeSignature}
          onDuration={(duration) => dispatch({ type: 'setDuration', duration })}
          onToggleDot={() => dispatch({ type: 'toggleDotted' })}
          onRest={() => dispatch({ type: 'insertRest' })}
          onBackspace={() => dispatch({ type: 'deleteBackward' })}
        />
        <FruitKeyboard
          octaveShift={state.octaveShift}
          onNote={(pitch, baseOctave) => dispatch({ type: 'insertNote', pitch, baseOctave })}
          onShift={(delta) => dispatch({ type: 'shiftOctave', delta })}
        />
        <p className="hint">
          Tip: type C–B to add notes, 1–4 for note lengths, R for a rest, “.” for a dot, arrows to
          move, Backspace to delete. Click a fruit to put the cursor right after it.
        </p>
      </div>

      <SongPages
        song={state.song}
        cursorIndex={state.cursor}
        onEventClick={(index) => dispatch({ type: 'setCursor', index: index + 1 })}
      />
    </div>
  );
}
