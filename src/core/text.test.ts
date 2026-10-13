import { describe, expect, it } from 'vitest';
import { slugify } from './text';

describe('slugify', () => {
  it('makes safe, readable file names', () => {
    expect(slugify('Twinkle Twinkle Little Star')).toBe('twinkle-twinkle-little-star');
    expect(slugify('  Au Clair de la Lune (my copy)! ')).toBe('au-clair-de-la-lune-my-copy');
    expect(slugify('Ödé tô Jöy')).toBe('ode-to-joy');
    expect(slugify('!!!')).toBe('song');
  });
});
