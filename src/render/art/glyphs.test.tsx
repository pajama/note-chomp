import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DURATIONS } from '../../core/model/types';
import { FlagGlyph, RestGlyph, TrebleClef } from './glyphs';
import { Monster } from './Monster';

const markup = (el: ReactElement) => renderToStaticMarkup(<svg>{el}</svg>);

describe('Monster', () => {
  it('scales its 100-unit-wide drawing to the requested width', () => {
    const svg = markup(<Monster x={5} y={7} width={30} height={36} />);
    expect(svg).toContain('data-kind="monster"');
    expect(svg).toContain('transform="translate(5 7) scale(0.3)"');
  });
  it('has an open mouth facing right (Pac-Man wedge path)', () => {
    expect(markup(<Monster x={0} y={0} width={100} height={120} />)).toContain(
      'M48 62 L84.5 37.4 A44 44 0 1 0 84.5 86.6 Z',
    );
  });
});

describe('RestGlyph', () => {
  it('draws a distinct glyph for every duration', () => {
    const svgs = DURATIONS.map((d) => markup(<RestGlyph duration={d} x={0} y={0} spacing={10} />));
    expect(new Set(svgs).size).toBe(4);
    svgs.forEach((svg) => expect(svg).toContain('data-kind="rest"'));
  });
});

describe('FlagGlyph', () => {
  it('mirrors vertically for down stems', () => {
    expect(markup(<FlagGlyph x={1} y={2} direction="up" size={5} color="#000000" />)).toContain(
      'scale(5 5)',
    );
    expect(markup(<FlagGlyph x={1} y={2} direction="down" size={5} color="#000000" />)).toContain(
      'scale(5 -5)',
    );
  });
});

describe('TrebleClef', () => {
  it('renders a stroked path anchored on the G line', () => {
    const svg = markup(<TrebleClef x={10} y={50} spacing={6} />);
    expect(svg).toContain('data-kind="clef"');
    expect(svg).toContain('translate(16 50) scale(6)');
  });
});
