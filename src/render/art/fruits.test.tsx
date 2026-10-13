import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PITCHES, type Pitch } from '../../core/model/types';
import { PALETTE, type FruitKind } from '../../core/palette/palette';
import { FruitArt, FruitGlyph } from './fruits';

/**
 * Extents (unit-box coordinates) of every part that reaches toward the box edge, worst case = hollow
 * (outline 0.10 → half 0.05; leaves 0.03 → 0.015; stalks 0.065 → 0.0325; grape/raspberry berries 0.07 (solid and hollow) → 0.035;
 * blueberry crown 0.02 → 0.01). Solid fruit have a thinner outline (0.075) and their face/shine sit well inside.
 * `evidence` = the exact attributes the numbers were computed from; the test fails if the drawing changes
 * without this table being recomputed. Numbers are rounded outward to 3 decimals.
 *   circle:  cx ± (r + hw), cy ± (r + hw)
 *   ellipse rotated θ: half-width √(rx²cos²θ + ry²sin²θ) + hw, half-height √(rx²sin²θ + ry²cos²θ) + hw
 *   butt-capped line: endpoints ± hw along the line's normal
 *   cubic paths (round joins): extremes of the curve, sampled at 2000 steps per segment, ± hw
 */
interface Extent {
  part: string;
  evidence: string[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const APPLE_D =
  'd="M0 -0.27 C0.2 -0.43 0.49 -0.36 0.47 0 C0.46 0.3 0.24 0.46 0 0.39 C-0.24 0.46 -0.46 0.3 -0.47 0 C-0.49 -0.36 -0.2 -0.43 0 -0.27 Z"';
const LEMON_D =
  'd="M-0.5 0 C-0.45 -0.05 -0.42 -0.42 0 -0.42 C0.42 -0.42 0.45 -0.05 0.5 0 C0.45 0.05 0.42 0.42 0 0.42 C-0.42 0.42 -0.45 0.05 -0.5 0 Z"';
const PEAR_D =
  'd="M0 -0.4 C0.13 -0.4 0.16 -0.26 0.19 -0.14 C0.24 0 0.45 0.08 0.44 0.25 C0.43 0.42 0.22 0.45 0 0.45 C-0.22 0.45 -0.43 0.42 -0.44 0.25 C-0.45 0.08 -0.24 0 -0.19 -0.14 C-0.16 -0.26 -0.13 -0.4 0 -0.4 Z"';

const EXTENTS: Record<FruitKind, Extent[]> = {
  apple: [
    // lobe tops y ≈ -0.352; sides x ≈ ±0.471; bottom lobes y ≈ 0.407
    { part: 'body', evidence: [APPLE_D], minX: -0.521, maxX: 0.521, minY: -0.402, maxY: 0.457 },
    // (0,-0.27)→(0.03,-0.46): normal (0.988, 0.156) × 0.0325
    {
      part: 'stalk',
      evidence: ['x1="0" y1="-0.27" x2="0.03" y2="-0.46"'],
      minX: -0.033,
      maxX: 0.063,
      minY: -0.466,
      maxY: -0.264,
    },
    // θ = -30°: half-width 0.1185 + 0.015, half-height 0.0864 + 0.015
    {
      part: 'leaf',
      evidence: ['cx="0.17" cy="-0.38" rx="0.13" ry="0.065"'],
      minX: 0.037,
      maxX: 0.303,
      minY: -0.481,
      maxY: -0.279,
    },
  ],
  orange: [
    {
      part: 'body',
      evidence: ['cx="0" cy="0.02" r="0.43"'],
      minX: -0.48,
      maxX: 0.48,
      minY: -0.46,
      maxY: 0.5,
    },
    // θ = -20°: half-width 0.1251 + 0.015, half-height 0.0763 + 0.015
    {
      part: 'leaf',
      evidence: ['cx="0.11" cy="-0.4" rx="0.13" ry="0.065"'],
      minX: -0.03,
      maxX: 0.25,
      minY: -0.491,
      maxY: -0.309,
    },
  ],
  lemon: [
    // tips x = ±0.5 (smooth vertical tangent there); top/bottom y = ∓0.42 (horizontal tangent)
    { part: 'body', evidence: [LEMON_D], minX: -0.55, maxX: 0.55, minY: -0.47, maxY: 0.47 },
  ],
  pear: [
    // top (0,-0.4) and bottom (0,0.45) have horizontal tangents; widest x ≈ 0.441
    { part: 'body', evidence: [PEAR_D], minX: -0.491, maxX: 0.491, minY: -0.45, maxY: 0.5 },
    // (0,-0.39)→(0.04,-0.47): normal (0.894, 0.447) × 0.0325
    {
      part: 'stalk',
      evidence: ['x1="0" y1="-0.39" x2="0.04" y2="-0.47"'],
      minX: -0.03,
      maxX: 0.07,
      minY: -0.485,
      maxY: -0.375,
    },
    // θ = -30°: half-width 0.1095 + 0.015, half-height 0.0794 + 0.015
    {
      part: 'leaf',
      evidence: ['cx="0.15" cy="-0.39" rx="0.12" ry="0.06"'],
      minX: 0.026,
      maxX: 0.274,
      minY: -0.485,
      maxY: -0.295,
    },
  ],
  blueberry: [
    {
      part: 'body',
      evidence: ['cx="0" cy="0" r="0.44"'],
      minX: -0.49,
      maxX: 0.49,
      minY: -0.49,
      maxY: 0.49,
    },
    // star polygon x ±0.11, y from -0.4 to -0.2, stroked 0.02 with round joins
    {
      part: 'crown',
      evidence: ['points="0,-0.4 0.035,-0.33 0.11,-0.32 '],
      minX: -0.12,
      maxX: 0.12,
      minY: -0.411,
      maxY: -0.19,
    },
  ],
  grape: [
    // berries r = 0.15 at (±0.27,-0.2) (±0.09,-0.22) … (±0.09,0.26)
    {
      part: 'berries',
      evidence: [
        'cx="-0.27" cy="-0.2" r="0.15"',
        'cx="-0.09" cy="-0.22" r="0.15"',
        'cx="0.09" cy="0.26" r="0.15"',
      ],
      minX: -0.456,
      maxX: 0.456,
      minY: -0.405,
      maxY: 0.446,
    },
    // (0,-0.36)→(0.04,-0.47): normal (0.940, 0.342) × 0.0325
    {
      part: 'stalk',
      evidence: ['x1="0" y1="-0.36" x2="0.04" y2="-0.47"'],
      minX: -0.031,
      maxX: 0.071,
      minY: -0.482,
      maxY: -0.348,
    },
    // θ = -20°: half-width 0.1150 + 0.015, half-height 0.0700 + 0.015
    {
      part: 'leaf',
      evidence: ['cx="0.17" cy="-0.4" rx="0.12" ry="0.06"'],
      minX: 0.04,
      maxX: 0.3,
      minY: -0.485,
      maxY: -0.315,
    },
  ],
  raspberry: [
    // drupelets r = 0.1: widest row x = ±0.32, top row y = -0.22, bottom y = 0.31
    {
      part: 'drupelets',
      evidence: [
        'cx="-0.32" cy="-0.03" r="0.1"',
        'cx="-0.08" cy="-0.22" r="0.1"',
        'cx="0" cy="0.31" r="0.1"',
      ],
      minX: -0.456,
      maxX: 0.456,
      minY: -0.355,
      maxY: 0.446,
    },
    // θ = ±20°: half-width 0.1051 + 0.015, half-height 0.0610 + 0.015
    {
      part: 'side sepals',
      evidence: [
        'cx="-0.12" cy="-0.33" rx="0.11" ry="0.05"',
        'cx="0.12" cy="-0.33" rx="0.11" ry="0.05"',
      ],
      minX: -0.24,
      maxX: 0.24,
      minY: -0.406,
      maxY: -0.254,
    },
    // θ = 90°: half-height = rx 0.09 + 0.015
    {
      part: 'top sepal',
      evidence: ['cx="0" cy="-0.36" rx="0.09" ry="0.045"'],
      minX: -0.06,
      maxX: 0.06,
      minY: -0.465,
      maxY: -0.255,
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

  it.each(PITCHES)('%s solid has a chunky dark outline in the stroke shade', (pitch) => {
    const svg = renderToStaticMarkup(<FruitArt pitch={pitch} hollow={false} />);
    // grape berries and raspberry drupelets are many small circles: 0.07 each
    const width = ['grape', 'raspberry'].includes(PALETTE[pitch].fruit) ? '0.07' : '0.075';
    expect(svg).toContain(
      `fill="${PALETTE[pitch].color}" stroke="${PALETTE[pitch].stroke}" stroke-width="${width}"`,
    );
  });

  it.each(PITCHES)('%s solid smiles (dark eyes + smile); hollow stays faceless', (pitch) => {
    const solid = renderToStaticMarkup(<FruitArt pitch={pitch} hollow={false} />);
    const face = /<g data-part="face"[^>]*>(.*?)<\/g>/.exec(solid);
    expect(face, 'face').not.toBeNull();
    const parts = face?.[1] ?? '';
    expect(parts.match(/<circle/g)).toHaveLength(2);
    expect(parts).toContain(`fill="${PALETTE[pitch].stroke}"`);
    expect(parts).toContain(`stroke="${PALETTE[pitch].stroke}"`);
    const hollow = renderToStaticMarkup(<FruitArt pitch={pitch} hollow />);
    expect(hollow).not.toContain('data-part="face"');
    expect(hollow).not.toContain('data-part="shine"');
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
