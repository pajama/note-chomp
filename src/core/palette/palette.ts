import type { Pitch } from '../model/types';

export type FruitKind = 'apple' | 'orange' | 'lemon' | 'pear' | 'blueberry' | 'grape' | 'raspberry';

export interface PaletteEntry {
  fruit: FruitKind;
  fruitName: string;
  solfege: string;
  /** Main fill (solid notes) and outline (hollow notes). */
  color: string;
  /** Pale fill for hollow (half/whole) notes. */
  tint: string;
  /** Darker shade for outlines and labels — keeps yellow legible on white paper. */
  stroke: string;
}

/**
 * Chroma-Notes / Boomwhackers rainbow, as used by Prodigies.
 * Single source of truth for note colors — change colors here only.
 */
export const PALETTE: Readonly<Record<Pitch, PaletteEntry>> = {
  C: {
    fruit: 'apple',
    fruitName: 'Apple',
    solfege: 'Do',
    color: '#E53935',
    tint: '#FDE3E2',
    stroke: '#9E1F1C',
  },
  D: {
    fruit: 'orange',
    fruitName: 'Orange',
    solfege: 'Re',
    color: '#FB8C00',
    tint: '#FFEBD1',
    stroke: '#A65B00',
  },
  E: {
    fruit: 'lemon',
    fruitName: 'Lemon',
    solfege: 'Mi',
    color: '#FDD835',
    tint: '#FFF8D6',
    stroke: '#9A7F00',
  },
  F: {
    fruit: 'pear',
    fruitName: 'Pear',
    solfege: 'Fa',
    color: '#7CB342',
    tint: '#EAF4DE',
    stroke: '#4B6E22',
  },
  G: {
    fruit: 'blueberry',
    fruitName: 'Blueberry',
    solfege: 'Sol',
    color: '#26C6DA',
    tint: '#DDF6FA',
    stroke: '#0E7C8A',
  },
  A: {
    fruit: 'grape',
    fruitName: 'Grapes',
    solfege: 'La',
    color: '#8E24AA',
    tint: '#F1DDF6',
    stroke: '#5A1370',
  },
  B: {
    fruit: 'raspberry',
    fruitName: 'Raspberry',
    solfege: 'Ti',
    color: '#EC407A',
    tint: '#FDE0EA',
    stroke: '#A3174A',
  },
};

export const NEUTRAL = {
  ink: '#37474F',
  staff: '#546E7A',
  twig: '#8D6E63',
  leaf: '#66BB6A',
  leafStroke: '#2E7D32',
  fruitStem: '#6D4C41',
  paper: '#FFFFFF',
} as const;
