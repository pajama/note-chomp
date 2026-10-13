import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { METRICS } from '../../core/layout/metrics';
import { DURATIONS } from '../../core/model/types';
import { FlagGlyph, RestGlyph, TrebleClef } from './glyphs';
import { Monster, MONSTER_MOUTH } from './Monster';

const markup = (el: ReactElement) => renderToStaticMarkup(<svg>{el}</svg>);

describe('Monster', () => {
  it('scales its 100-unit-wide drawing to the requested width', () => {
    const svg = markup(<Monster x={5} y={7} width={30} height={36} />);
    expect(svg).toContain('data-kind="monster"');
    expect(svg).toContain('transform="translate(5 7) scale(0.3)"');
  });
  it('has an open mouth facing right (Pac-Man wedge path)', () => {
    expect(markup(<Monster x={0} y={0} width={100} height={120} />)).toContain(
      'M50 64 L84.8 40.5 A42 42 0 1 0 84.8 87.5 Z',
    );
    const { hinge, upperJaw, lowerJaw } = MONSTER_MOUTH;
    // both jaw tips lie to the right of the hinge, one above and one below it
    expect(upperJaw[0]).toBeGreaterThan(hinge[0]);
    expect(lowerJaw[0]).toBeGreaterThan(hinge[0]);
    expect(upperJaw[1]).toBeLessThan(hinge[1]);
    expect(lowerJaw[1]).toBeGreaterThan(hinge[1]);
    // the tips sit on the body circle (center 50,64, r 42)
    for (const [x, y] of [upperJaw, lowerJaw])
      expect(Math.hypot(x - 50, y - 64)).toBeCloseTo(42, 0);
  });
  it('shows teeth along both jaws and stays inside its 100 × 120 box', () => {
    const svg = markup(<Monster x={0} y={0} width={100} height={120} />);
    expect(svg.match(/fill="#FFFFFF" stroke="#2A1B3D"/g)).toHaveLength(5);
    const numbers = [...svg.matchAll(/ d="([^"]+)"/g)].flatMap((m) =>
      (m[1].match(/-?\d+(\.\d+)?/g) ?? []).map(Number),
    );
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(100);
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
  it('reaches METRICS.flagReach to the right of the stem (layout spacing relies on it)', () => {
    const svg = markup(<FlagGlyph x={0} y={0} direction="up" size={1} color="#000000" />);
    // outer curve: M0 0 C0.1 0.9 1.0 1.2 0.8 2.2 — sample x(t) for its rightmost point
    expect(svg).toContain('d="M0 0 C0.1 0.9 1.0 1.2 0.8 2.2');
    let maxX = 0;
    for (let t = 0; t <= 1; t += 0.001) {
      const u = 1 - t;
      maxX = Math.max(maxX, 3 * u * u * t * 0.1 + 3 * u * t * t * 1.0 + t * t * t * 0.8);
    }
    expect(maxX).toBeLessThanOrEqual(METRICS.flagReach);
    expect(maxX).toBeGreaterThan(METRICS.flagReach - 0.005);
  });
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
