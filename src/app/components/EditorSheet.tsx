import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  compactSheet,
  cursorPosition,
  DEFAULT_RENDER_OPTIONS,
  editorHitTargets,
  layoutSong,
  measureBox,
  PAPER_SIZES_MM,
} from '../../core/layout';
import type { Song } from '../../core/model/types';
import { SheetSvg } from '../../render/svg/SheetSvg';
import { scrollAnchorSelector } from '../editorFocus';
import { messageOf } from '../useSongLibrary';

/** The editor always shows the default (Large) staff; print options apply only to Print. */
export const EDITOR_OPTIONS = DEFAULT_RENDER_OPTIONS;

/** Where the paper is drawn at least this many px per mm, the editor shows it as it prints. */
export const MIN_PX_PER_MM = 2.8;
/**
 * Narrower screens lay the song out on a page this wide instead. A 4/4 bar of quarter notes
 * still gets a system to itself (a wider page fits two bars at a smaller scale), so note columns
 * come out about 1.7x as wide as on Letter: 45px on a 390px phone, 36px even at 320px.
 */
export const NARROW_SHEET_MM = 150;
/** A finger that moves less than this between down and up is a tap, not a scroll. */
export const TAP_SLOP_PX = 10;

/**
 * The page width to lay the editor sheet out on, for a scroller `contentPx` wide: undefined (the
 * paper width) where the paper already fits at MIN_PX_PER_MM, else NARROW_SHEET_MM. Two values
 * only, so resizing a phone or rotating it doesn't re-lay out the song.
 */
export function editorSheetWidthMm(
  contentPx: number,
  paperMm: number = PAPER_SIZES_MM.letter.width,
): number | undefined {
  if (!(contentPx > 0) || contentPx / MIN_PX_PER_MM >= paperMm) return undefined;
  return Math.min(paperMm, NARROW_SHEET_MM);
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface EditorSheetProps {
  song: Song;
  cursor: number;
  selection: number | null;
  playing: number | null;
  /** Measure to flash after an error (1-based), or null. */
  flashMeasure: number | null;
  onNotePointerDown: (eventIndex: number, e: ReactPointerEvent<SVGRectElement>) => void;
  onGapClick: (index: number) => void;
  /** A press on blank sheet: margins, clef, between systems (a finger: only a tap, not a swipe). */
  onBackgroundPointerDown?: () => void;
  /** True while a note is being dragged: the sheet must not scroll under the finger. */
  isDragging?: () => boolean;
}

/** The scrolling sheet in the middle of the editor. Keeps the cursor / selection / playing note in view. */
export function EditorSheet({
  song,
  cursor,
  selection,
  playing,
  flashMeasure,
  onNotePointerDown,
  onGapClick,
  onBackgroundPointerDown,
  isDragging,
}: EditorSheetProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [sheetWidthMm, setSheetWidthMm] = useState<number | undefined>(undefined);
  const view = useMemo(() => {
    try {
      const options = { ...EDITOR_OPTIONS, sheetWidthMm };
      const result = layoutSong(song, options);
      return {
        ok: true as const,
        result,
        sheet: compactSheet(result, options.staffSpaceMm),
        targets: editorHitTargets(result),
      };
    } catch (e) {
      return { ok: false as const, message: messageOf(e) };
    }
  }, [song, sheetWidthMm]);

  // The latest of what the resize observer needs, so it never has to be re-created.
  const latest = useRef({ playing, selection, isDragging });
  useEffect(() => {
    latest.current = { playing, selection, isDragging };
  });

  // After any edit, move, or playback step: keep the thing you're looking at on screen. Not while
  // a note is being dragged: the sheet would slide under the finger.
  useEffect(() => {
    if (isDragging?.()) return;
    const anchor = scroller.current?.querySelector(scrollAnchorSelector(playing, selection));
    anchor?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [playing, selection, cursor, song.events, isDragging]);

  // Lay the sheet out for the scroller's width, and keep the same note in view after a resize
  // or rotation. A callback ref: the scroller isn't rendered while the song can't be laid out.
  const observer = useRef<ResizeObserver | null>(null);
  const setScroller = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    scroller.current = el;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    observer.current = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSheetWidthMm(editorSheetWidthMm(entry.contentRect.width));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { playing, selection, isDragging } = latest.current;
        if (isDragging?.()) return;
        el.querySelector(scrollAnchorSelector(playing, selection))?.scrollIntoView?.({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'auto',
        });
      });
    });
    observer.current.observe(el);
  }, []);

  // A finger or pen on blank sheet lets go of the note only on a tap: a swipe there scrolls.
  const pendingTap = useRef<(() => void) | null>(null);
  useEffect(() => () => pendingTap.current?.(), []);

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
    if (e.pointerType === 'mouse') {
      onBackgroundPointerDown?.();
      return;
    }
    pendingTap.current?.();
    const start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    const onUp = (u: PointerEvent) => {
      if (u.pointerId !== start.id) return;
      pendingTap.current?.();
      const moved = Math.hypot(u.clientX - start.x, u.clientY - start.y);
      if (u.type === 'pointerup' && moved < TAP_SLOP_PX) onBackgroundPointerDown?.();
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    pendingTap.current = () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      pendingTap.current = null;
    };
  };
  return (
    <div
      className="sheet-scroll"
      ref={setScroller}
      data-testid="song-pages"
      onPointerDown={onSheetPointerDown}
      onContextMenu={(e) => {
        // No long-press menu or callout on the staff.
        if (e.target instanceof Element && e.target.closest('svg')) e.preventDefault();
      }}
    >
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
