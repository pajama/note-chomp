import { describe, expect, it } from 'vitest';
import { METRICS, stepY, systemBandMm } from './metrics';
import { DEFAULT_RENDER_OPTIONS, STAFF_SIZES } from './options';

describe('stepY', () => {
  it('puts step 0 (E4) on the bottom line and step 8 (F5) on the top line', () => {
    expect(stepY(100, 10, 0)).toBe(140);
    expect(stepY(100, 10, 8)).toBe(100);
  });
  it('moves half a space per step', () => {
    expect(stepY(100, 10, -2)).toBe(150);
    expect(stepY(100, 10, 1)).toBe(135);
  });
});

describe('metrics', () => {
  it('reserves room for the whole G3–C6 range plus labels', () => {
    // G3 fruit bottom: 2.5 spaces below bottom line + half a fruit
    expect(METRICS.below).toBeGreaterThan(2.5 + METRICS.fruitSize / 2 + METRICS.labelFontSize);
    // C6 fruit top: 2 spaces above top line + half a fruit
    expect(METRICS.above).toBeGreaterThan(2 + METRICS.fruitSize / 2);
  });
  it('keeps note labels clear of the lowest fruit, even at the biggest size-by-duration scale', () => {
    // cap height of Helvetica ≈ 0.72 × font size
    const labelCapTop = METRICS.labelBaselineBelow - 0.72 * METRICS.labelFontSize;
    const g3WholeBottom = 2.5 + (METRICS.sizeByDurationScale.w * METRICS.fruitSize) / 2;
    expect(labelCapTop).toBeGreaterThan(g3WholeBottom);
    // descenders (≈ 0.25 × font size) stay inside the system band
    expect(METRICS.below).toBeGreaterThan(
      METRICS.labelBaselineBelow + 0.25 * METRICS.labelFontSize,
    );
  });
  it('computes the band height of one system', () => {
    expect(systemBandMm(10)).toBeCloseTo((METRICS.above + 4 + METRICS.below) * 10);
  });
  it('defaults to the Large staff on Letter paper', () => {
    expect(DEFAULT_RENDER_OPTIONS.staffSpaceMm).toBe(STAFF_SIZES.large);
    expect(DEFAULT_RENDER_OPTIONS.paper).toBe('letter');
  });
});
