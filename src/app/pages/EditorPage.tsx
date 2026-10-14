import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createEditorState, editorReducer } from '../../core/editor/editorReducer';
import { createEmptySong } from '../../core/model/factories';
import { newSongId } from '../../core/model/id';
import { TIME_SIGNATURES, type Pitch, type Song, type TimeSignature } from '../../core/model/types';
import { isInRange, toNoteName } from '../../core/theory/pitch';
import { clearDraft, saveDraft } from '../../persistence/draft';
import { DurationPicker } from '../components/DurationPicker';
import { EDITOR_OPTIONS, EditorSheet } from '../components/EditorSheet';
import { FruitKeyboard } from '../components/FruitKeyboard';
import { HelpPopover } from '../components/HelpPopover';
import { PlaybackControls } from '../components/PlaybackControls';
import { Toast } from '../components/Toast';
import { selectionAnnouncement } from '../editorFocus';
import { useEditorKeyboard, type EditorCommand } from '../hooks/useEditorKeyboard';
import { useNoteDrag } from '../hooks/useNoteDrag';
import { usePlayback } from '../hooks/usePlayback';
import { useToast } from '../hooks/useToast';
import { navigate, setNavigationGuard } from '../router';
import { useServices } from '../services';
import { messageOf, useSongLibrary, type SongLibrary } from '../useSongLibrary';

export const LEAVE_UNSAVED_MESSAGE = 'Your song is not saved yet. Leave without saving it?';
export const NEW_SONG_MESSAGE = "Start a new song? Your current one isn't saved.";
/** How long the problem measure flashes after an error. */
const FLASH_MS = 1200;

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
  const [saving, setSaving] = useState(false);
  const [flashMeasure, setFlashMeasure] = useState<number | null>(null);
  const toast = useToast();
  const playback = usePlayback(state.song);
  const selected = state.selection === null ? undefined : state.song.events[state.selection];

  // Reducer errors become a toast plus a brief flash on the measure they are about.
  const { show } = toast;
  useEffect(() => {
    if (!state.error) return;
    show(state.error);
    setFlashMeasure(state.errorMeasure);
    dispatch({ type: 'dismissError' });
  }, [state.error, state.errorMeasure, show]);
  useEffect(() => {
    if (flashMeasure === null) return;
    const timer = setTimeout(() => setFlashMeasure(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashMeasure]);
  const { error: playbackError, dismissError: dismissPlaybackError } = playback;
  useEffect(() => {
    if (!playbackError) return;
    show(playbackError);
    dismissPlaybackError();
  }, [playbackError, dismissPlaybackError, show]);

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
    () =>
      setNavigationGuard((reason) => {
        if (!dirtyRef.current) return true;
        const newSong = reason === 'new-song';
        const ok = window.confirm(newSong ? NEW_SONG_MESSAGE : LEAVE_UNSAVED_MESSAGE);
        if (ok && newSong) clearDraft(storage);
        return ok;
      }),
    [storage],
  );

  const previewPitch = (pitch: Pitch, baseOctave: 4 | 5) => {
    const octave = baseOctave + state.octaveShift;
    if (isInRange(pitch, octave)) playback.preview(toNoteName(pitch, octave));
  };

  const onNote = (pitch: Pitch, baseOctave: 4 | 5) => {
    previewPitch(pitch, baseOctave);
    dispatch(
      state.selection === null
        ? { type: 'insertNote', pitch, baseOctave }
        : { type: 'changeSelectedPitch', pitch, baseOctave },
    );
  };

  const onRest = () =>
    dispatch(state.selection === null ? { type: 'insertRest' } : { type: 'restSelected' });

  const togglePlayback = () => {
    if (playback.playing) playback.stop();
    else playback.play(state.selection ?? 0);
  };

  const onCommand = (command: EditorCommand) => {
    if (command.type === 'togglePlayback') return togglePlayback();
    if (command.type === 'insertNote' || command.type === 'changeSelectedPitch') {
      previewPitch(command.pitch, command.baseOctave);
    }
    dispatch(command);
  };
  useEditorKeyboard(onCommand, state.selection !== null);

  const onNotePointerDown = useNoteDrag({
    events: state.song.events,
    dispatch,
    preview: playback.preview,
    staffSpaceMm: EDITOR_OPTIONS.staffSpaceMm,
  });
  const onGapClick = useCallback((index: number) => dispatch({ type: 'setCursor', index }), []);
  const onBackgroundPointerDown = useCallback(() => dispatch({ type: 'clearSelection' }), []);

  const save = async (): Promise<Song | undefined> => {
    setSaving(true);
    try {
      const saved = await library.save(state.song);
      dispatch({ type: 'markSaved' });
      dirtyRef.current = false;
      clearDraft(storage);
      return saved;
    } catch (e) {
      show(messageOf(e));
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

  return (
    <div className="editor">
      <div className="editor-topbar toolbar no-print">
        <input
          type="text"
          aria-label="Song title"
          placeholder="Name your song"
          maxLength={100}
          value={state.song.title}
          onChange={(e) => dispatch({ type: 'setTitle', title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
          }}
        />
        <select
          aria-label="Time signature"
          value={state.song.timeSignature}
          onChange={(e) => {
            dispatch({ type: 'setTimeSignature', timeSignature: e.target.value as TimeSignature });
            e.currentTarget.blur();
          }}
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

      <EditorSheet
        song={state.song}
        cursor={state.cursor}
        selection={state.selection}
        playing={playback.currentEventIndex}
        flashMeasure={flashMeasure}
        onNotePointerDown={onNotePointerDown}
        onBackgroundPointerDown={onBackgroundPointerDown}
        onGapClick={onGapClick}
      />

      <div className="sr-only" aria-live="polite" data-testid="selection-announcer">
        {selectionAnnouncement(state.song.events, state.selection)}
      </div>

      <div className="editor-dock no-print">
        <Toast message={toast.toast} onDismiss={toast.dismiss} />
        <div className="dock-row">
          <PlaybackControls
            status={playback.status}
            canPlay={state.song.events.length > 0}
            bpm={playback.bpm}
            onPlay={() => playback.play(state.selection ?? 0)}
            onStop={playback.stop}
            onBpm={playback.setBpm}
          />
          <DurationPicker
            duration={selected?.duration ?? state.duration}
            dotted={selected ? !!selected.dotted : state.dotted}
            timeSignature={state.song.timeSignature}
            onDuration={(duration) => dispatch({ type: 'setDuration', duration })}
            onToggleDot={() => dispatch({ type: 'toggleDotted' })}
            onRest={onRest}
            onBackspace={() => dispatch({ type: 'deleteBackward' })}
          />
          <HelpPopover />
        </div>
        <FruitKeyboard
          octaveShift={state.octaveShift}
          onNote={onNote}
          onShift={(delta) => dispatch({ type: 'shiftOctave', delta })}
        />
      </div>
    </div>
  );
}
