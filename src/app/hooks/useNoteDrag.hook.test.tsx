// @vitest-environment jsdom
import { act, type PointerEvent as ReactPointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { note } from '../../core/model/factories';
import { DRAG_THRESHOLD_PX, useNoteDrag } from './useNoteDrag';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Drag = ReturnType<typeof useNoteDrag>;

function mount(selection: number | null) {
  const dispatch = vi.fn();
  let drag: Drag | undefined;
  function Probe() {
    drag = useNoteDrag({
      events: [note('C', 4, 'q'), note('D', 4, 'q')],
      selection,
      dispatch,
      preview: () => undefined,
      staffSpaceMm: 6.5,
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Probe />));
  if (!drag) throw new Error('not rendered');
  return { drag, dispatch, unmount: () => act(() => root.unmount()) };
}

function windowPointer(type: string, clientY: number, pointerId = 1) {
  const e = new Event(type);
  Object.assign(e, { pointerId, clientY, clientX: 0 });
  window.dispatchEvent(e);
}

function press(drag: Drag, index: number, pointerType: string, clientY = 100) {
  const svg = {
    viewBox: { baseVal: { width: 100 } },
    getBoundingClientRect: () => ({ width: 400 }),
  };
  drag.onNotePointerDown(index, {
    button: 0,
    pointerId: 1,
    pointerType,
    clientY,
    preventDefault: () => undefined,
    currentTarget: { ownerSVGElement: svg, setPointerCapture: () => undefined },
  } as unknown as ReactPointerEvent<SVGRectElement>);
}

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe('useNoteDrag isDragging', () => {
  it('is false until the press moves past the threshold, true during the drag, false after', () => {
    const { drag, dispatch, unmount } = mount(1);
    cleanup = unmount;
    expect(drag.isDragging()).toBe(false);
    press(drag, 1, 'touch');
    expect(drag.isDragging()).toBe(false);
    windowPointer('pointermove', 100 - DRAG_THRESHOLD_PX);
    expect(drag.isDragging()).toBe(false);
    windowPointer('pointermove', 100 - DRAG_THRESHOLD_PX - 20);
    expect(drag.isDragging()).toBe(true);
    windowPointer('pointerup', 80);
    expect(drag.isDragging()).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({ type: 'endDrag' });
  });

  it('is never true for a finger on a note that was not selected', () => {
    const { drag, unmount } = mount(null);
    cleanup = unmount;
    press(drag, 1, 'touch');
    windowPointer('pointermove', 40);
    expect(drag.isDragging()).toBe(false);
    windowPointer('pointercancel', 40);
  });

  it('starts a drag even where pointer capture fails (a synthetic or already-gone pointer)', () => {
    const { drag, dispatch, unmount } = mount(1);
    cleanup = unmount;
    const svg = {
      viewBox: { baseVal: { width: 100 } },
      getBoundingClientRect: () => ({ width: 400 }),
    };
    drag.onNotePointerDown(1, {
      button: 0,
      pointerId: 1,
      pointerType: 'touch',
      clientY: 100,
      preventDefault: () => undefined,
      currentTarget: {
        ownerSVGElement: svg,
        setPointerCapture: () => {
          throw new DOMException('No active pointer with the given id is found.', 'NotFoundError');
        },
      },
    } as unknown as ReactPointerEvent<SVGRectElement>);
    windowPointer('pointermove', 60);
    expect(drag.isDragging()).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'dragSelected' }));
    windowPointer('pointerup', 60);
  });
});
