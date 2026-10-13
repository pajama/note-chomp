import { describe, expect, it } from 'vitest';
import { pdfFileName } from './exportPdf';

describe('pdfFileName', () => {
  it('slugifies the title', () => {
    expect(pdfFileName('Twinkle Twinkle Little Star')).toBe('twinkle-twinkle-little-star.pdf');
    expect(pdfFileName('???')).toBe('song.pdf');
  });
});
