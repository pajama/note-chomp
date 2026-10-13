import { describe, expect, it } from 'vitest';
import { DURATIONS } from '../model/types';
import { LEGEND_HEIGHT_MM, METRICS, stepY, systemBandMm, TITLE_HEIGHT_MM } from './metrics';
import { DEFAULT_RENDER_OPTIONS, PAGE_MARGIN_MM, PAPER_SIZES_MM, STAFF_SIZES } from './options';

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
  const half = METRICS.fruitSize / 2;
  const biggestHalf = (METRICS.fruitSize * METRICS.sizeByDurationScale.w) / 2;

  it('draws fruit about 1.3× a standard note head', () => {
    expect(METRICS.fruitSize).toBe(1.2);
  });

  it('reserves room for the whole G3–C6 range plus labels', () => {
    // G3 fruit bottom: 2.5 spaces below bottom line + half a fruit (+ the label row)
    expect(METRICS.below).toBeGreaterThan(2.5 + biggestHalf + METRICS.labelFontSize);
    // C6 fruit top: 2 spaces above the top line + half the biggest (size-by-duration whole) fruit
    expect(METRICS.above).toBeGreaterThanOrEqual(2 + biggestHalf);
  });

  it('keeps note labels clear of the lowest fruit, even at the biggest size-by-duration scale', () => {
    // cap height of Helvetica ≈ 0.72 × font size
    const labelCapTop = METRICS.labelBaselineBelow - 0.72 * METRICS.labelFontSize;
    expect(labelCapTop - (2.5 + half)).toBeGreaterThanOrEqual(0.3);
    expect(labelCapTop - (2.5 + biggestHalf)).toBeGreaterThanOrEqual(0.15);
    // descenders (≈ 0.25 × font size) stay inside the system band
    expect(METRICS.below).toBeGreaterThan(
      METRICS.labelBaselineBelow + 0.25 * METRICS.labelFontSize,
    );
  });

  it('keeps 3 Large systems on a Letter page', () => {
    const available =
      PAPER_SIZES_MM.letter.height - 2 * PAGE_MARGIN_MM - TITLE_HEIGHT_MM - LEGEND_HEIGHT_MM;
    const gap = METRICS.systemGap * STAFF_SIZES.large;
    const perPage = Math.floor((available + gap) / (systemBandMm(STAFF_SIZES.large) + gap));
    expect(perPage).toBe(3);
  });

  describe('horizontal spacing leaves a ≥ 0.3-space gap between neighbouring notes', () => {
    const MIN_GAP = 0.3;
    const ledgerHalf = half + METRICS.ledgerExtension;
    const stemRight = half * 2 * 0.42 + METRICS.stemWidth / 2;
    const flagRight = half * 2 * 0.42 + METRICS.flagReach * METRICS.flagSize;
    const dotRight = half + METRICS.dotGap + METRICS.dotRadius;
    const shortest = Math.min(...DURATIONS.map((d) => METRICS.advance[d]));

    it('ledger lines of neighbouring notes never touch', () => {
      expect(shortest - 2 * ledgerHalf).toBeGreaterThanOrEqual(MIN_GAP - 1e-9);
    });
    it('an up-stem and its flag end before the next fruit', () => {
      expect(METRICS.advance.e - flagRight - half).toBeGreaterThanOrEqual(MIN_GAP);
      expect(shortest - stemRight - ledgerHalf).toBeGreaterThanOrEqual(MIN_GAP);
    });
    it('an augmentation dot ends before the next note, even next to its ledger line', () => {
      for (const d of DURATIONS) {
        const advance = METRICS.advance[d] + METRICS.dottedExtra;
        expect(advance - dotRight - ledgerHalf, d).toBeGreaterThanOrEqual(MIN_GAP);
      }
    });
    it('notes keep clear of the bar lines on both sides', () => {
      const barHalf = METRICS.barLineWidth / 2;
      expect(METRICS.barPadding + METRICS.noteLead - ledgerHalf - barHalf).toBeGreaterThanOrEqual(
        MIN_GAP,
      );
      const lastRight = (d: (typeof DURATIONS)[number], reach: number) =>
        METRICS.advance[d] - METRICS.noteLead + METRICS.measureEndPadding - reach - barHalf;
      expect(lastRight('e', flagRight)).toBeGreaterThanOrEqual(MIN_GAP);
      for (const d of DURATIONS)
        expect(lastRight(d, ledgerHalf), d).toBeGreaterThanOrEqual(MIN_GAP);
    });
    it('longer notes get more room', () => {
      expect(METRICS.advance.e).toBeLessThan(METRICS.advance.q);
      expect(METRICS.advance.q).toBeLessThan(METRICS.advance.h);
      expect(METRICS.advance.h).toBeLessThan(METRICS.advance.w);
    });
  });

  it('computes the band height of one system', () => {
    expect(systemBandMm(10)).toBeCloseTo((METRICS.above + 4 + METRICS.below) * 10);
  });
  it('defaults to the Large staff on Letter paper', () => {
    expect(DEFAULT_RENDER_OPTIONS.staffSpaceMm).toBe(STAFF_SIZES.large);
    expect(DEFAULT_RENDER_OPTIONS.paper).toBe('letter');
  });
});
