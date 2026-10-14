import { describe, expect, it } from 'vitest';
import { copyTitle, slugify } from './text';

describe('slugify', () => {
  it('makes safe, readable file names', () => {
    expect(slugify('Twinkle Twinkle Little Star')).toBe('twinkle-twinkle-little-star');
    expect(slugify('  Au Clair de la Lune (my copy)! ')).toBe('au-clair-de-la-lune-my-copy');
    expect(slugify('Ödé tô Jöy')).toBe('ode-to-joy');
    expect(slugify('!!!')).toBe('song');
  });
});

describe('copyTitle', () => {
  it('adds "(my copy)" when the name is free', () => {
    expect(copyTitle('Ode to Joy', [])).toBe('Ode to Joy (my copy)');
    expect(copyTitle('Ode to Joy', ['Ode to Joy'])).toBe('Ode to Joy (my copy)');
  });
  it('numbers further copies', () => {
    expect(copyTitle('Ode to Joy', ['Ode to Joy (my copy)'])).toBe('Ode to Joy (my copy 2)');
    expect(
      copyTitle('Ode to Joy', [
        'Ode to Joy (my copy)',
        'Ode to Joy (my copy 2)',
        'Ode to Joy (my copy 4)',
      ]),
    ).toBe('Ode to Joy (my copy 3)');
  });
});
