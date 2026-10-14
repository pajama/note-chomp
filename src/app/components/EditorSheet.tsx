import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import {
  compactSheet,
  cursorPosition,
  DEFAULT_RENDER_OPTIONS,
  editorHitTargets,
  layoutSong,
  measureBox,
} from '../../core/layout';
import type { Song } from '../../core/model/types';
import { SheetSvg } from '../../render/svg/SheetSvg';
import { messageOf } from '../useSongLibrary';

/** The editor always shows the default (Large) staff; print options apply only to Print. */
export const EDITOR_OPTIONS = DEFAULT_RENDER_OPTIONS;

export interface EditorSheetProps {
  song: Song;
  cursor: number;
  selection: number | null;
  playing: number | null;
  /** Measure to flash after an error (1-based), or null. */
  flashMeasure: number | null;
  onNotePointerDown: (eventIndex: number, e: ReactPointerEvent<SVGRectElement>) => void;
  onGapClick: (index: number) => void;
  /** A press on blank sheet: margins, clef, between systems. */
  onBackgroundPointerDown?: () => void;
}

/** The scrolling sheet in the middle of the editor. */
export function EditorSheet({
  song,
  cursor,
  selection,
  playing,
  flashMeasure,
  onNotePointerDown,
  onGapClick,
  onBackgroundPointerDown,
}: EditorSheetProps) {
  const view = useMemo(() => {
    try {
      const result = layoutSong(song, EDITOR_OPTIONS);
      return {
        ok: true as const,
        result,
        sheet: compactSheet(result, EDITOR_OPTIONS.staffSpaceMm),
        targets: editorHitTargets(result),
      };
    } catch (e) {
      return { ok: false as const, message: messageOf(e) };
    }
  }, [song]);

  if (!view.ok) {
    return (
      <p className="alert error" role="alert">
        {view.message}
      </p>
    );
  }

  const onSheetPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-kind="note-target"], [data-kind="gap-target"]')) return;
    // On the scroller itself, a press right of its content box is on the scrollbar.
    if (target === e.currentTarget && e.nativeEvent.offsetX >= e.currentTarget.clientWidth) return;
    onBackgroundPointerDown?.();
  };
  return (
    <div className="sheet-scroll" data-testid="song-pages" onPointerDown={onSheetPointerDown}>
      <SheetSvg
        sheet={view.sheet}
        targets={view.targets}
        events={song.events}
        title={song.title}
        cursor={
          selection === null
            ? cursorPosition(view.result, cursor, EDITOR_OPTIONS.staffSpaceMm)
            : undefined
        }
        selection={selection}
        playing={playing}
        flash={flashMeasure === null ? null : measureBox(view.result, flashMeasure)}
        onNotePointerDown={onNotePointerDown}
        onGapClick={onGapClick}
      />
    </div>
  );
}
