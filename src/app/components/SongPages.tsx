import { useMemo } from 'react';
import {
  cursorPosition,
  DEFAULT_RENDER_OPTIONS,
  layoutSong,
  type RenderOptions,
} from '../../core/layout';
import type { Song } from '../../core/model/types';
import { PageSvg } from '../../render/svg/PageSvg';
import { messageOf } from '../useSongLibrary';

export interface SongPagesProps {
  song: Song;
  options?: RenderOptions;
  cursorIndex?: number;
  onEventClick?: (eventIndex: number) => void;
}

export function SongPages({
  song,
  options = DEFAULT_RENDER_OPTIONS,
  cursorIndex,
  onEventClick,
}: SongPagesProps) {
  const layout = useMemo(() => {
    try {
      return { ok: true as const, result: layoutSong(song, options) };
    } catch (e) {
      return { ok: false as const, message: messageOf(e) };
    }
  }, [song, options]);

  if (!layout.ok) {
    return (
      <p className="alert error" role="alert">
        {layout.message}
      </p>
    );
  }
  const cursor =
    cursorIndex === undefined
      ? undefined
      : cursorPosition(layout.result, cursorIndex, options.staffSpaceMm);
  return (
    <div className="song-pages" data-testid="song-pages">
      {layout.result.pages.map((page) => (
        <PageSvg
          key={page.index}
          page={page}
          cursor={cursor}
          onEventClick={onEventClick}
          className="page-svg"
        />
      ))}
    </div>
  );
}
