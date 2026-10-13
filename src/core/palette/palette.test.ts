import { describe, expect, it } from 'vitest';
import { PITCHES } from '../model/types';
import { NEUTRAL, PALETTE } from './palette';

const HEX = /^#[0-9A-F]{6}$/;

describe('PALETTE', () => {
  it('maps the legend from the spec', () => {
    expect(PITCHES.map((p) => PALETTE[p].fruit)).toEqual([
      'apple',
      'orange',
      'lemon',
      'pear',
      'blueberry',
      'grape',
      'raspberry',
    ]);
    expect(PITCHES.map((p) => PALETTE[p].solfege)).toEqual([
      'Do',
      'Re',
      'Mi',
      'Fa',
      'Sol',
      'La',
      'Ti',
    ]);
  });

  it('uses distinct, valid uppercase hex colors', () => {
    const colors = PITCHES.map((p) => PALETTE[p].color);
    expect(new Set(colors).size).toBe(7);
    for (const p of PITCHES) {
      expect(PALETTE[p].color).toMatch(HEX);
      expect(PALETTE[p].tint).toMatch(HEX);
      expect(PALETTE[p].stroke).toMatch(HEX);
    }
    for (const value of Object.values(NEUTRAL)) expect(value).toMatch(HEX);
  });
});
