import { describe, expect, it } from 'vitest';
import { PAPER_SIZES_MM } from '../../core/layout';
import { editorSheetWidthMm, MIN_PX_PER_MM, NARROW_SHEET_MM } from './EditorSheet';

describe('editorSheetWidthMm', () => {
  it('lays a phone sheet out narrower than the paper, so note columns stay finger-sized', () => {
    expect(editorSheetWidthMm(366)).toBe(NARROW_SHEET_MM); // 390px phone
    expect(editorSheetWidthMm(296)).toBe(NARROW_SHEET_MM); // 320px phone
    expect(editorSheetWidthMm(454)).toBe(NARROW_SHEET_MM); // 844px landscape phone
    expect(NARROW_SHEET_MM).toBe(150);
  });
  it('keeps the paper width where it already fits (tablets, desktop)', () => {
    expect(editorSheetWidthMm(772)).toBeUndefined();
    expect(editorSheetWidthMm(2000)).toBeUndefined();
    const threshold = PAPER_SIZES_MM.letter.width * MIN_PX_PER_MM;
    expect(editorSheetWidthMm(threshold)).toBeUndefined();
    expect(editorSheetWidthMm(threshold - 1)).toBe(NARROW_SHEET_MM);
  });
  it('waits for a real size', () => {
    expect(editorSheetWidthMm(0)).toBeUndefined();
    expect(editorSheetWidthMm(Number.NaN)).toBeUndefined();
  });
  it('never lays out wider than the paper', () => {
    expect(editorSheetWidthMm(300, 140)).toBe(140);
  });
});
