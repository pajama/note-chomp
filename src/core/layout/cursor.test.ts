import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../model/factories';
import { cursorPosition, DEFAULT_RENDER_OPTIONS, layoutSong } from './index';

const S = DEFAULT_RENDER_OPTIONS.staffSpaceMm;

describe('cursorPosition', () => {
  it('sits at the start of an empty staff', () => {
    const result = layoutSong(createEmptySong('Empty'));
    const pos = cursorPosition(result, 0, S);
    expect(pos.pageIndex).toBe(0);
    expect(pos.x).toBeCloseTo(result.pages[0].systems[0].startX + 0.5 * S);
  });

  it('sits just before the requested event', () => {
    const song = { ...createEmptySong('Two'), events: [note('C', 4, 'q'), note('D', 4, 'q')] };
    const result = layoutSong(song);
    const slot = result.pages[0].systems[0].slots[1];
    expect(cursorPosition(result, 1, S).x).toBeCloseTo(slot.x + 0.15 * S);
  });

  it('sits after the last event when the cursor is at the end', () => {
    const song = { ...createEmptySong('Two'), events: [note('C', 4, 'q'), note('D', 4, 'q')] };
    const result = layoutSong(song);
    const system = result.pages[0].systems[0];
    const pos = cursorPosition(result, 2, S);
    expect(pos.x).toBeGreaterThan(system.slots[1].x);
    expect(pos.x).toBeLessThanOrEqual(system.endX);
  });
});
