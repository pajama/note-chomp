import { describe, expect, it } from 'vitest';
import { canDrag, dragSteps, staffSpacePx } from './useNoteDrag';

describe('dragSteps', () => {
  it('moves one line or space per half staff space, upward positive', () => {
    expect(dragSteps(-10, 20)).toBe(1);
    expect(dragSteps(-20, 20)).toBe(2);
    expect(dragSteps(30, 20)).toBe(-3);
  });
  it('rounds to the nearest step', () => {
    expect(dragSteps(-4, 20)).toBe(0);
    expect(dragSteps(-6, 20)).toBe(1);
    expect(dragSteps(4, 20)).toBe(0);
  });
  it('is 0 when the staff has no size yet', () => {
    expect(dragSteps(-50, 0)).toBe(0);
  });
});

describe('staffSpacePx', () => {
  const svg = (viewWidth: number, pxWidth: number) =>
    ({
      viewBox: { baseVal: { width: viewWidth } },
      getBoundingClientRect: () => ({ width: pxWidth }),
    }) as unknown as SVGSVGElement;

  it('scales staff space from sheet units (mm) to on-screen px', () => {
    expect(staffSpacePx(svg(200, 800), 6.5)).toBe(26);
  });
  it('is 0 without an svg or before it has a size', () => {
    expect(staffSpacePx(null, 6.5)).toBe(0);
    expect(staffSpacePx(svg(0, 800), 6.5)).toBe(0);
  });
});

describe('canDrag', () => {
  it('lets a mouse press-and-drag any note', () => {
    expect(canDrag('mouse', false)).toBe(true);
    expect(canDrag('mouse', true)).toBe(true);
  });
  it('lets a finger or pen drag only a note that was already selected', () => {
    expect(canDrag('touch', false)).toBe(false);
    expect(canDrag('pen', false)).toBe(false);
    expect(canDrag('touch', true)).toBe(true);
    expect(canDrag('pen', true)).toBe(true);
  });
});
