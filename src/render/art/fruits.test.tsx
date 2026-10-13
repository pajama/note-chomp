import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PITCHES, type Pitch } from '../../core/model/types';
import { PALETTE, type FruitKind } from '../../core/palette/palette';
import { FruitArt, FruitGlyph } from './fruits';

/**
 * Hand-computed extents (unit-box coordinates) of every part that reaches toward the box edge,
 * worst case = hollow (stroke 0.10 → half 0.05; leaves 0.025 → 0.0125; stalks 0.06 → 0.03; grape berries 0.07 → 0.035).
 * `evidence` = the exact attributes the numbers were computed from; the test fails if the drawing changes
 * without this table being recomputed.
 *   circle:  cx ± (r + hw), cy ± (r + hw)
 *   ellipse rotated θ: half-width √(rx²cos²θ + ry²sin²θ) + hw, half-height √(rx²sin²θ + ry²cos²θ) + hw
 *   butt-capped line: endpoints ± hw along the line's normal
 *   cubic paths: extremes of the curve (solve B'(t) = 0) ± hw along the normal there
 */
interface Extent {
  part: string;
  evidence: string[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const EXTENTS: Record<FruitKind, Extent[]> = {
  apple: [
    // lobe tops y = -0.371 at t ≈ 0.45 of each upper curve; sides x = ±0.465; bottom lobes y = 0.416
    {
      part: 'body',
      evidence: [
        'd="M0 -0.3 C0.25 -0.48 0.5 -0.3 0.46 0.02 C0.43 0.3 0.22 0.47 0 0.4 C-0.22 0.47 -0.43 0.3 -0.46 0.02 C-0.5 -0.3 -0.25 -0.48 0 -0.3 Z"',
      ],
      minX: -0.515,
      maxX: 0.515,
      minY: -0.422,
      maxY: 0.466,
    },
    // (0,-0.3)→(0.05,-0.47): normal (0.959, 0.282) × 0.03 → tip corners y = -0.47 ± 0.0085
    {
      part: 'stalk',
      evidence: ['x2="0.05" y2="-0.47"'],
      minX: -0.029,
      maxX: 0.079,
      minY: -0.479,
      maxY: -0.291,
    },
    // θ = -25°: half-width 0.1117 + 0.0125, half-height 0.0744 + 0.0125
    {
      part: 'leaf',
      evidence: ['cx="0.18" cy="-0.39" rx="0.12" ry="0.06"'],
      minX: 0.055,
      maxX: 0.305,
      minY: -0.477,
      maxY: -0.303,
    },
  ],
  orange: [
    {
      part: 'body',
      evidence: ['cx="0" cy="0.02" r="0.42"'],
      minX: -0.47,
      maxX: 0.47,
      minY: -0.45,
      maxY: 0.49,
    },
    // θ = -20°: half-width 0.1145 + 0.0125, half-height 0.0697 + 0.0125
    {
      part: 'leaf',
      evidence: ['cx="0.1" cy="-0.41" rx="0.12" ry="0.06"'],
      minX: -0.028,
      maxX: 0.228,
      minY: -0.493,
      maxY: -0.327,
    },
  ],
  lemon: [
    // tips x = ±0.5 (bevelled join adds ≈ hw); y extremes -1.2·t(1-t) = ∓0.3 at t = 0.5
    {
      part: 'body',
      evidence: ['d="M-0.5 0 C-0.46 -0.4 0.46 -0.4 0.5 0 C0.46 0.4 -0.46 0.4 -0.5 0 Z"'],
      minX: -0.551,
      maxX: 0.551,
      minY: -0.35,
      maxY: 0.35,
    },
  ],
  pear: [
    // top (0,-0.42) has a horizontal tangent; widest x = 0.359; bottom (0,0.44)
    {
      part: 'body',
      evidence: [
        'd="M0 -0.42 C0.14 -0.42 0.18 -0.25 0.2 -0.12 C0.42 0 0.46 0.42 0 0.44 C-0.46 0.42 -0.42 0 -0.2 -0.12 C-0.18 -0.25 -0.14 -0.42 0 -0.42 Z"',
      ],
      minX: -0.409,
      maxX: 0.409,
      minY: -0.47,
      maxY: 0.49,
    },
    // (0,-0.4)→(0.04,-0.47): normal (0.868, 0.496) × 0.03 → tip corners y = -0.47 ± 0.0149
    {
      part: 'stalk',
      evidence: ['x2="0.04" y2="-0.47"'],
      minX: -0.026,
      maxX: 0.066,
      minY: -0.485,
      maxY: -0.385,
    },
    // θ = -30°: half-width 0.1082 + 0.0125, half-height 0.0794 + 0.0125
    {
      part: 'leaf',
      evidence: ['cx="0.14" cy="-0.4" rx="0.12" ry="0.06"'],
      minX: 0.019,
      maxX: 0.261,
      minY: -0.492,
      maxY: -0.308,
    },
  ],
  blueberry: [
    {
      part: 'body',
      evidence: ['cx="0" cy="0" r="0.42"'],
      minX: -0.47,
      maxX: 0.47,
      minY: -0.47,
      maxY: 0.47,
    },
    // unstroked polygon: x ±0.0951, y from -0.36 to -0.1791
    {
      part: 'crown',
      evidence: ['points="0,-0.36 '],
      minX: -0.096,
      maxX: 0.096,
      minY: -0.36,
      maxY: -0.179,
    },
  ],
  grape: [
    // berries r = 0.155 at (±0.2,-0.22) … (0,0.26)
    {
      part: 'berries',
      evidence: ['cx="-0.2" cy="-0.22" r="0.155"', 'cx="0" cy="0.26" r="0.155"'],
      minX: -0.39,
      maxX: 0.39,
      minY: -0.41,
      maxY: 0.45,
    },
    // (0,-0.37)→(0.04,-0.47): normal (0.928, 0.371) × 0.03 → tip corners y = -0.47 ± 0.0111
    {
      part: 'stalk',
      evidence: ['x1="0" y1="-0.37" x2="0.04" y2="-0.47"'],
      minX: -0.028,
      maxX: 0.068,
      minY: -0.482,
      maxY: -0.358,
    },
    {
      part: 'leaf',
      evidence: ['cx="0.15" cy="-0.4" rx="0.12" ry="0.06"'],
      minX: 0.022,
      maxX: 0.278,
      minY: -0.483,
      maxY: -0.317,
    },
  ],
  raspberry: [
    // top y = -0.08 - 0.75·0.34 = -0.335 at t = 0.5; sides x = ±0.4; bottom (0,0.44) horizontal tangent
    {
      part: 'body',
      evidence: [
        'd="M-0.4 -0.08 C-0.4 -0.42 0.4 -0.42 0.4 -0.08 C0.4 0.26 0.2 0.44 0 0.44 C-0.2 0.44 -0.4 0.26 -0.4 -0.08 Z"',
      ],
      minX: -0.45,
      maxX: 0.45,
      minY: -0.385,
      maxY: 0.49,
    },
    // θ = ±20°: half-width 0.0955 + 0.0125, half-height 0.0581 + 0.0125
    {
      part: 'side sepals',
      evidence: [
        'cx="-0.1" cy="-0.33" rx="0.1" ry="0.05"',
        'cx="0.1" cy="-0.33" rx="0.1" ry="0.05"',
      ],
      minX: -0.209,
      maxX: 0.209,
      minY: -0.401,
      maxY: -0.259,
    },
    // θ = 90°: half-height = rx 0.09 + 0.0125
    {
      part: 'top sepal',
      evidence: ['cx="0" cy="-0.36" rx="0.09" ry="0.045"'],
      minX: -0.058,
      maxX: 0.058,
      minY: -0.463,
      maxY: -0.257,
    },
  ],
};

describe('FruitArt', () => {
  it.each(PITCHES)('%s solid uses the main color as fill', (pitch) => {
    const svg = renderToStaticMarkup(<FruitArt pitch={pitch} hollow={false} />);
    expect(svg).toContain(`fill="${PALETTE[pitch].color}"`);
    expect(svg).not.toContain(`fill="${PALETTE[pitch].tint}"`);
  });

  it.each(PITCHES)('%s hollow uses the tint fill with a colored outline', (pitch) => {
    const svg = renderToStaticMarkup(<FruitArt pitch={pitch} hollow />);
    expect(svg).toContain(`fill="${PALETTE[pitch].tint}"`);
    expect(svg).toContain(`stroke="${PALETTE[pitch].color}"`);
  });

  it('draws a different shape for every fruit', () => {
    const shapes = PITCHES.map((p) =>
      renderToStaticMarkup(<FruitArt pitch={p} hollow={false} />).replaceAll(/#[0-9A-F]{6}/g, ''),
    );
    expect(new Set(shapes).size).toBe(7);
  });

  it('draws hollow outlines 0.10 thick and stalks with butt caps', () => {
    const svg = renderToStaticMarkup(<FruitArt pitch="C" hollow />);
    expect(svg).toContain('stroke-width="0.1"');
    expect(svg).toContain('stroke-linecap="butt"');
    expect(svg).not.toContain('stroke-linecap="round"');
  });

  it.each(PITCHES)(
    '%s: the extents table matches the drawing and stays inside the unit box',
    (pitch: Pitch) => {
      const svg = renderToStaticMarkup(<FruitArt pitch={pitch} hollow />);
      for (const extent of EXTENTS[PALETTE[pitch].fruit]) {
        for (const fragment of extent.evidence) expect(svg, extent.part).toContain(fragment);
        expect(extent.minY, extent.part).toBeGreaterThanOrEqual(-0.5);
        expect(extent.maxY, extent.part).toBeLessThanOrEqual(0.5);
        expect(extent.minX, extent.part).toBeGreaterThanOrEqual(-0.56);
        expect(extent.maxX, extent.part).toBeLessThanOrEqual(0.56);
      }
    },
  );
});

describe('FruitGlyph', () => {
  it('positions and scales the unit art and tags it for tests and clicks', () => {
    const svg = renderToStaticMarkup(
      <svg>
        <FruitGlyph pitch="E" x={10} y={20} size={6} hollow={false} eventIndex={3} />
      </svg>,
    );
    expect(svg).toContain('transform="translate(10 20) scale(6)"');
    expect(svg).toContain('data-kind="fruit"');
    expect(svg).toContain('data-pitch="E"');
    expect(svg).toContain('data-event-index="3"');
  });
});
