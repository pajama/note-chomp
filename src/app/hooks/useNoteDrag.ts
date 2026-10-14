import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { EditorAction } from '../../core/editor/editorReducer';
import type { MusicEvent } from '../../core/model/types';
import { clampedStepPitch, toNoteName } from '../../core/theory/pitch';

/** A press becomes a drag once it moves this far vertically. */
export const DRAG_THRESHOLD_PX = 4;

/** Diatonic steps for a vertical drag of `dy` px (up is positive); one step = half a staff space. */
export function dragSteps(dy: number, staffSpacePx: number): number {
  if (staffSpacePx <= 0) return 0;
  return Math.round(-dy / (staffSpacePx / 2)) || 0;
}

/**
 * A mouse may press and drag any note at once. A finger or pen must pick the note first (a tap):
 * otherwise a swipe to scroll the sheet would change whatever note it started on.
 */
export function canDrag(pointerType: string, wasSelected: boolean): boolean {
  return pointerType === 'mouse' || wasSelected;
}

interface Press {
  pointerId: number;
  startY: number;
  spacePx: number;
  event: MusicEvent;
  dragging: boolean;
  steps: number;
}

export interface NoteDragOptions {
  events: MusicEvent[];
  /** The selected event before the press (decides whether a touch press may drag). */
  selection: number | null;
  dispatch: (action: EditorAction) => void;
  preview: (note: string) => void;
  /** Staff space in sheet units (mm); converted to px from the sheet's on-screen size. */
  staffSpaceMm: number;
}

/** On-screen px per staff space for the <svg> a note target lives in. */
export function staffSpacePx(svg: SVGSVGElement | null, staffSpaceMm: number): number {
  const viewWidth = svg?.viewBox.baseVal?.width ?? 0;
  if (!svg || viewWidth <= 0) return 0;
  return (svg.getBoundingClientRect().width / viewWidth) * staffSpaceMm;
}

/**
 * pointerdown on a note column: select + preview; vertical drag: change pitch; release: one undo
 * step. A finger or pen first has to tap a note to select it (see canDrag).
 */
export function useNoteDrag({
  events,
  selection,
  dispatch,
  preview,
  staffSpaceMm,
}: NoteDragOptions) {
  const latest = useRef({ events, selection, dispatch, preview, staffSpaceMm });
  useEffect(() => {
    latest.current = { events, selection, dispatch, preview, staffSpaceMm };
  });
  const press = useRef<Press | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return useCallback((eventIndex: number, e: ReactPointerEvent<SVGRectElement>) => {
    const { events: current, selection } = latest.current;
    const event = current[eventIndex];
    if (!event || e.button !== 0) return;
    const draggable = canDrag(e.pointerType, selection === eventIndex);
    // preventDefault below stops the browser moving focus, so leave any text field ourselves.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('input, textarea, select')) active.blur();
    e.preventDefault();
    const choose = () => {
      latest.current.dispatch({ type: 'select', index: eventIndex });
      if (event.kind === 'note') latest.current.preview(toNoteName(event.pitch, event.octave));
    };
    cleanup.current?.();
    if (!draggable) {
      // A finger on a note that isn't selected: a tap selects it on release. A swipe scrolls the
      // sheet instead (the column is `pan-y`), which ends the press in pointercancel: no select.
      const onUp = (u: PointerEvent) => {
        if (u.pointerId !== e.pointerId) return;
        cleanup.current?.();
        if (u.type === 'pointerup') choose();
      };
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      cleanup.current = () => {
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        cleanup.current = null;
      };
      return;
    }
    choose();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      spacePx: staffSpacePx(e.currentTarget.ownerSVGElement, latest.current.staffSpaceMm),
      event,
      dragging: false,
      steps: 0,
    };

    const onMove = (m: PointerEvent) => {
      const p = press.current;
      if (!p || m.pointerId !== p.pointerId || p.event.kind !== 'note') return;
      const dy = m.clientY - p.startY;
      if (!p.dragging && Math.abs(dy) <= DRAG_THRESHOLD_PX) return;
      p.dragging = true;
      const steps = dragSteps(dy, p.spacePx);
      if (steps === p.steps) return;
      p.steps = steps;
      latest.current.dispatch({ type: 'dragSelected', steps });
      const moved = clampedStepPitch(p.event.pitch, p.event.octave, steps);
      latest.current.preview(toNoteName(moved.pitch, moved.octave));
    };
    const onEnd = (u: PointerEvent) => {
      const p = press.current;
      if (!p || u.pointerId !== p.pointerId) return;
      if (p.dragging) latest.current.dispatch({ type: 'endDrag' });
      press.current = null;
      cleanup.current?.();
    };
    // Where `touch-action: none` on an SVG child is ignored, a vertical drag would scroll the
    // sheet and end in pointercancel after one step; cancelling touchmove keeps the drag ours.
    const onTouchMove = (t: TouchEvent) => t.preventDefault();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    cleanup.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      cleanup.current = null;
    };
  }, []);
}
