# Phase 4 — Rendering (`src/render/`)

One SVG renderer serves both screen and PDF. Components are pure functions of layout items; they never compute music positions. Render tests use `renderToStaticMarkup` from `react-dom/server` in the default node environment (test files are `.test.tsx`).

Art coordinate convention: every fruit is drawn in a **unit box centered at (0,0)** (y down). Everything — body, leaves, stalks, **including half of each stroke width** — stays within y ∈ [−0.5, 0.5] and x ∈ [−0.56, 0.56]. Stalks use butt caps so they end where their coordinates say. `FruitGlyph` scales the unit box to `size` mm. `fruits.test.tsx` holds a hand-computed extents table for every fruit, tied to the drawing by the exact coordinates it was computed from.

### Task 12: Fruit art

**Files:**
- Create: `src/render/art/fruits.tsx`
- Test: `src/render/art/fruits.test.tsx`

**Interfaces:**
- Consumes: `PALETTE`, `NEUTRAL`, `FruitKind`, `PaletteEntry` (Task 5), `Pitch` (Task 2)
- Produces:
  - `FruitArt(props: { pitch: Pitch; hollow: boolean }): JSX.Element` — unit-box art
  - `FruitGlyph(props: { pitch: Pitch; x: number; y: number; size: number; hollow: boolean; eventIndex?: number; onClick?: (eventIndex: number) => void }): JSX.Element` — `<g data-kind="fruit" data-pitch=… data-event-index=…>`

- [ ] **Step 1: Write the failing test**

`src/render/art/fruits.test.tsx`:

```tsx
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
interface Extent { part: string; evidence: string[]; minX: number; maxX: number; minY: number; maxY: number }

const EXTENTS: Record<FruitKind, Extent[]> = {
  apple: [
    // lobe tops y = -0.371 at t ≈ 0.45 of each upper curve; sides x = ±0.465; bottom lobes y = 0.416
    { part: 'body', evidence: ['d="M0 -0.3 C0.25 -0.48 0.5 -0.3 0.46 0.02 C0.43 0.3 0.22 0.47 0 0.4 C-0.22 0.47 -0.43 0.3 -0.46 0.02 C-0.5 -0.3 -0.25 -0.48 0 -0.3 Z"'], minX: -0.515, maxX: 0.515, minY: -0.422, maxY: 0.466 },
    // (0,-0.3)→(0.05,-0.47): normal (0.959, 0.282) × 0.03 → tip corners y = -0.47 ± 0.0085
    { part: 'stalk', evidence: ['x2="0.05" y2="-0.47"'], minX: -0.029, maxX: 0.079, minY: -0.479, maxY: -0.291 },
    // θ = -25°: half-width 0.1117 + 0.0125, half-height 0.0744 + 0.0125
    { part: 'leaf', evidence: ['cx="0.18" cy="-0.39" rx="0.12" ry="0.06"'], minX: 0.055, maxX: 0.305, minY: -0.477, maxY: -0.303 },
  ],
  orange: [
    { part: 'body', evidence: ['cx="0" cy="0.02" r="0.42"'], minX: -0.47, maxX: 0.47, minY: -0.45, maxY: 0.49 },
    // θ = -20°: half-width 0.1145 + 0.0125, half-height 0.0697 + 0.0125
    { part: 'leaf', evidence: ['cx="0.1" cy="-0.41" rx="0.12" ry="0.06"'], minX: -0.028, maxX: 0.228, minY: -0.493, maxY: -0.327 },
  ],
  lemon: [
    // tips x = ±0.5 (bevelled join adds ≈ hw); y extremes -1.2·t(1-t) = ∓0.3 at t = 0.5
    { part: 'body', evidence: ['d="M-0.5 0 C-0.46 -0.4 0.46 -0.4 0.5 0 C0.46 0.4 -0.46 0.4 -0.5 0 Z"'], minX: -0.551, maxX: 0.551, minY: -0.35, maxY: 0.35 },
  ],
  pear: [
    // top (0,-0.42) has a horizontal tangent; widest x = 0.359; bottom (0,0.44)
    { part: 'body', evidence: ['d="M0 -0.42 C0.14 -0.42 0.18 -0.25 0.2 -0.12 C0.42 0 0.46 0.42 0 0.44 C-0.46 0.42 -0.42 0 -0.2 -0.12 C-0.18 -0.25 -0.14 -0.42 0 -0.42 Z"'], minX: -0.409, maxX: 0.409, minY: -0.47, maxY: 0.49 },
    // (0,-0.4)→(0.04,-0.47): normal (0.868, 0.496) × 0.03 → tip corners y = -0.47 ± 0.0149
    { part: 'stalk', evidence: ['x2="0.04" y2="-0.47"'], minX: -0.026, maxX: 0.066, minY: -0.485, maxY: -0.385 },
    // θ = -30°: half-width 0.1082 + 0.0125, half-height 0.0794 + 0.0125
    { part: 'leaf', evidence: ['cx="0.14" cy="-0.4" rx="0.12" ry="0.06"'], minX: 0.019, maxX: 0.261, minY: -0.492, maxY: -0.308 },
  ],
  blueberry: [
    { part: 'body', evidence: ['cx="0" cy="0" r="0.42"'], minX: -0.47, maxX: 0.47, minY: -0.47, maxY: 0.47 },
    // unstroked polygon: x ±0.0951, y from -0.36 to -0.1791
    { part: 'crown', evidence: ['points="0,-0.36 '], minX: -0.096, maxX: 0.096, minY: -0.36, maxY: -0.179 },
  ],
  grape: [
    // berries r = 0.155 at (±0.2,-0.22) … (0,0.26)
    { part: 'berries', evidence: ['cx="-0.2" cy="-0.22" r="0.155"', 'cx="0" cy="0.26" r="0.155"'], minX: -0.39, maxX: 0.39, minY: -0.41, maxY: 0.45 },
    // (0,-0.37)→(0.04,-0.47): normal (0.928, 0.371) × 0.03 → tip corners y = -0.47 ± 0.0111
    { part: 'stalk', evidence: ['x1="0" y1="-0.37" x2="0.04" y2="-0.47"'], minX: -0.028, maxX: 0.068, minY: -0.482, maxY: -0.358 },
    { part: 'leaf', evidence: ['cx="0.15" cy="-0.4" rx="0.12" ry="0.06"'], minX: 0.022, maxX: 0.278, minY: -0.483, maxY: -0.317 },
  ],
  raspberry: [
    // top y = -0.08 - 0.75·0.34 = -0.335 at t = 0.5; sides x = ±0.4; bottom (0,0.44) horizontal tangent
    { part: 'body', evidence: ['d="M-0.4 -0.08 C-0.4 -0.42 0.4 -0.42 0.4 -0.08 C0.4 0.26 0.2 0.44 0 0.44 C-0.2 0.44 -0.4 0.26 -0.4 -0.08 Z"'], minX: -0.45, maxX: 0.45, minY: -0.385, maxY: 0.49 },
    // θ = ±20°: half-width 0.0955 + 0.0125, half-height 0.0581 + 0.0125
    { part: 'side sepals', evidence: ['cx="-0.1" cy="-0.33" rx="0.1" ry="0.05"', 'cx="0.1" cy="-0.33" rx="0.1" ry="0.05"'], minX: -0.209, maxX: 0.209, minY: -0.401, maxY: -0.259 },
    // θ = 90°: half-height = rx 0.09 + 0.0125
    { part: 'top sepal', evidence: ['cx="0" cy="-0.36" rx="0.09" ry="0.045"'], minX: -0.058, maxX: 0.058, minY: -0.463, maxY: -0.257 },
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

  it.each(PITCHES)('%s: the extents table matches the drawing and stays inside the unit box', (pitch: Pitch) => {
    const svg = renderToStaticMarkup(<FruitArt pitch={pitch} hollow />);
    for (const extent of EXTENTS[PALETTE[pitch].fruit]) {
      for (const fragment of extent.evidence) expect(svg, extent.part).toContain(fragment);
      expect(extent.minY, extent.part).toBeGreaterThanOrEqual(-0.5);
      expect(extent.maxY, extent.part).toBeLessThanOrEqual(0.5);
      expect(extent.minX, extent.part).toBeGreaterThanOrEqual(-0.56);
      expect(extent.maxX, extent.part).toBeLessThanOrEqual(0.56);
    }
  });
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/render/art/fruits.test.tsx`
Expected: FAIL — cannot resolve `./fruits`.

- [ ] **Step 3: Implement `src/render/art/fruits.tsx`**

```tsx
import type { ReactElement } from 'react';
import type { Pitch } from '../../core/model/types';
import { NEUTRAL, PALETTE, type FruitKind, type PaletteEntry } from '../../core/palette/palette';

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

function bodyPaint(entry: PaletteEntry, hollow: boolean): Paint {
  return hollow
    ? { fill: entry.tint, stroke: entry.color, strokeWidth: 0.1 }
    : { fill: entry.color, stroke: entry.stroke, strokeWidth: 0.05 };
}

function Leaf({ cx, cy, rotate, rx = 0.12, ry = 0.06 }: { cx: number; cy: number; rotate: number; rx?: number; ry?: number }) {
  return (
    <ellipse
      cx={cx} cy={cy} rx={rx} ry={ry}
      transform={`rotate(${rotate} ${cx} ${cy})`}
      fill={NEUTRAL.leaf} stroke={NEUTRAL.leafStroke} strokeWidth={0.025}
    />
  );
}

function Stalk({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={NEUTRAL.fruitStem} strokeWidth={0.06} strokeLinecap="butt" />;
}

function Shine({ cx, cy, rx, ry, hollow }: { cx: number; cy: number; rx: number; ry: number; hollow: boolean }) {
  if (hollow) return null;
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFFFFF" opacity={0.45} />;
}

type ShapeFn = (paint: Paint, entry: PaletteEntry, hollow: boolean) => ReactElement;

const BLUEBERRY_CROWN =
  '0,-0.36 0.0265,-0.2964 0.0951,-0.2909 0.0428,-0.2461 0.0588,-0.1791 0,-0.215 -0.0588,-0.1791 -0.0428,-0.2461 -0.0951,-0.2909 -0.0265,-0.2964';

const GRAPES: [number, number][] = [
  [-0.2, -0.22], [0, -0.22], [0.2, -0.22], [-0.1, 0.02], [0.1, 0.02], [0, 0.26],
];

const DRUPELETS: [number, number][] = [
  [-0.2, -0.12], [0, -0.15], [0.2, -0.12], [-0.25, 0.08], [-0.08, 0.06],
  [0.08, 0.06], [0.25, 0.08], [-0.14, 0.25], [0.04, 0.27], [0.19, 0.22],
];

const SHAPES: Record<FruitKind, ShapeFn> = {
  apple: (p, _e, hollow) => (
    <>
      <Stalk x1={0} y1={-0.3} x2={0.05} y2={-0.47} />
      <path
        d="M0 -0.3 C0.25 -0.48 0.5 -0.3 0.46 0.02 C0.43 0.3 0.22 0.47 0 0.4 C-0.22 0.47 -0.43 0.3 -0.46 0.02 C-0.5 -0.3 -0.25 -0.48 0 -0.3 Z"
        {...p}
      />
      <Leaf cx={0.18} cy={-0.39} rotate={-25} />
      <Shine cx={-0.22} cy={-0.1} rx={0.07} ry={0.13} hollow={hollow} />
    </>
  ),
  orange: (p, e, hollow) => (
    <>
      <circle cx={0} cy={0.02} r={0.42} {...p} />
      {[[-0.15, 0.08], [0.16, 0.12], [0, 0.24], [0.12, -0.14], [-0.2, -0.12]].map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={0.025} fill={e.stroke} opacity={0.5} />
      ))}
      <Leaf cx={0.1} cy={-0.41} rotate={-20} />
      <Shine cx={-0.2} cy={-0.16} rx={0.06} ry={0.11} hollow={hollow} />
    </>
  ),
  lemon: (p, _e, hollow) => (
    <>
      <path d="M-0.5 0 C-0.46 -0.4 0.46 -0.4 0.5 0 C0.46 0.4 -0.46 0.4 -0.5 0 Z" {...p} />
      <Shine cx={-0.18} cy={-0.12} rx={0.13} ry={0.05} hollow={hollow} />
    </>
  ),
  pear: (p, _e, hollow) => (
    <>
      <Stalk x1={0} y1={-0.4} x2={0.04} y2={-0.47} />
      <path
        d="M0 -0.42 C0.14 -0.42 0.18 -0.25 0.2 -0.12 C0.42 0 0.46 0.42 0 0.44 C-0.46 0.42 -0.42 0 -0.2 -0.12 C-0.18 -0.25 -0.14 -0.42 0 -0.42 Z"
        {...p}
      />
      <Leaf cx={0.14} cy={-0.4} rotate={-30} />
      <Shine cx={-0.16} cy={0.1} rx={0.06} ry={0.12} hollow={hollow} />
    </>
  ),
  blueberry: (p, e, hollow) => (
    <>
      <circle cx={0} cy={0} r={0.42} {...p} />
      <polygon points={BLUEBERRY_CROWN} fill={hollow ? e.color : e.stroke} />
      <Shine cx={-0.2} cy={0.02} rx={0.06} ry={0.1} hollow={hollow} />
    </>
  ),
  grape: (p, _e, hollow) => (
    <>
      <Stalk x1={0} y1={-0.37} x2={0.04} y2={-0.47} />
      <Leaf cx={0.15} cy={-0.4} rotate={-20} />
      {GRAPES.map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={0.155} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth * 0.7} />
      ))}
      <Shine cx={-0.24} cy={-0.27} rx={0.035} ry={0.06} hollow={hollow} />
    </>
  ),
  raspberry: (p, e) => (
    <>
      <path
        d="M-0.4 -0.08 C-0.4 -0.42 0.4 -0.42 0.4 -0.08 C0.4 0.26 0.2 0.44 0 0.44 C-0.2 0.44 -0.4 0.26 -0.4 -0.08 Z"
        {...p}
      />
      {DRUPELETS.map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={0.07} fill="none" stroke={e.stroke} strokeWidth={0.025} />
      ))}
      <Leaf cx={-0.1} cy={-0.33} rotate={20} rx={0.1} ry={0.05} />
      <Leaf cx={0.1} cy={-0.33} rotate={-20} rx={0.1} ry={0.05} />
      <Leaf cx={0} cy={-0.36} rotate={90} rx={0.09} ry={0.045} />
    </>
  ),
};

export function FruitArt({ pitch, hollow }: { pitch: Pitch; hollow: boolean }) {
  const entry = PALETTE[pitch];
  return SHAPES[entry.fruit](bodyPaint(entry, hollow), entry, hollow);
}

export interface FruitGlyphProps {
  pitch: Pitch;
  x: number;
  y: number;
  size: number;
  hollow: boolean;
  eventIndex?: number;
  onClick?: (eventIndex: number) => void;
}

export function FruitGlyph({ pitch, x, y, size, hollow, eventIndex, onClick }: FruitGlyphProps) {
  const clickable = onClick !== undefined && eventIndex !== undefined;
  return (
    <g
      data-kind="fruit"
      data-pitch={pitch}
      data-event-index={eventIndex}
      transform={`translate(${x} ${y}) scale(${size})`}
      onClick={clickable ? () => onClick(eventIndex) : undefined}
      style={clickable ? { cursor: 'pointer' } : undefined}
    >
      <FruitArt pitch={pitch} hollow={hollow} />
    </g>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/render/art/fruits.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render && git commit -m "feat(render): SVG fruit art for all seven notes (solid + hollow)"
```

---

### Task 13: Monster, treble clef, rest and flag glyphs

**Files:**
- Create: `src/render/art/Monster.tsx`, `src/render/art/glyphs.tsx`
- Test: `src/render/art/glyphs.test.tsx`

**Interfaces:**
- Consumes: `NEUTRAL` (Task 5), `Duration` (Task 2)
- Produces:
  - `Monster(props: { x: number; y: number; width: number; height: number }): JSX.Element` — drawn in a 100×120 box, mouth open to the right, `data-kind="monster"`
  - `TrebleClef(props: { x: number; y: number; spacing: number }): JSX.Element` — `y` = G line
  - `RestGlyph(props: { duration: Duration; x: number; y: number; spacing: number; eventIndex?: number }): JSX.Element` — `y` = middle line, `data-kind="rest"`
  - `FlagGlyph(props: { x: number; y: number; direction: 'up' | 'down'; size: number; color: string }): JSX.Element` — `(x, y)` = stem tip

The monster deliberately uses indigo (`#5C6BC0`), which is not in the note legend, so it never reads as a note.

- [ ] **Step 1: Write the failing test**

`src/render/art/glyphs.test.tsx`:

```tsx
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
    expect(markup(<Monster x={0} y={0} width={100} height={120} />)).toContain('M48 62 L84.5 37.4 A44 44 0 1 0 84.5 86.6 Z');
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
    expect(markup(<FlagGlyph x={1} y={2} direction="up" size={5} color="#000000" />)).toContain('scale(5 5)');
    expect(markup(<FlagGlyph x={1} y={2} direction="down" size={5} color="#000000" />)).toContain('scale(5 -5)');
  });
});

describe('TrebleClef', () => {
  it('renders a stroked path anchored on the G line', () => {
    const svg = markup(<TrebleClef x={10} y={50} spacing={6} />);
    expect(svg).toContain('data-kind="clef"');
    expect(svg).toContain('translate(16 50) scale(6)');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/render/art/glyphs.test.tsx`
Expected: FAIL — cannot resolve `./glyphs`.

- [ ] **Step 3: Implement**

`src/render/art/Monster.tsx`:

```tsx
const BODY = '#5C6BC0';
const BODY_DARK = '#283593';
const BELLY = '#9FA8DA';
const HORN = '#FFE0B2';
const TONGUE = '#F48FB1';
const INK = '#263238';

/** Chomp the monster. Drawn in a 100 × 120 box; mouth (wedge) opens to the right. */
export function Monster({ x, y, width }: { x: number; y: number; width: number; height: number }) {
  return (
    <g data-kind="monster" transform={`translate(${x} ${y}) scale(${width / 100})`}>
      <ellipse cx={35} cy={110} rx={12} ry={7} fill={BODY_DARK} />
      <ellipse cx={62} cy={110} rx={12} ry={7} fill={BODY_DARK} />
      <path d="M30 26 L24 6 L42 20 Z" fill={HORN} stroke={BODY_DARK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M56 20 L68 4 L69 24 Z" fill={HORN} stroke={BODY_DARK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M48 62 L84.5 37.4 A44 44 0 1 0 84.5 86.6 Z" fill={BODY} stroke={BODY_DARK} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={38} cy={80} rx={20} ry={16} fill={BELLY} />
      <ellipse cx={64} cy={64} rx={9} ry={4.5} fill={TONGUE} />
      <path d="M67.4 48.9 L72.4 45.6 L73.25 52.2 Z" fill="#FFFFFF" stroke={BODY_DARK} strokeWidth={1} />
      <path d="M75.4 43.5 L80.4 40.2 L81.3 46.8 Z" fill="#FFFFFF" stroke={BODY_DARK} strokeWidth={1} />
      <path d="M71.06 77.54 L76.04 80.9 L76.9 74.24 Z" fill="#FFFFFF" stroke={BODY_DARK} strokeWidth={1} />
      <circle cx={46} cy={36} r={11} fill="#FFFFFF" stroke={BODY_DARK} strokeWidth={2} />
      <circle cx={50} cy={36} r={5.5} fill={INK} />
      <circle cx={52} cy={34} r={1.8} fill="#FFFFFF" />
    </g>
  );
}
```

`src/render/art/glyphs.tsx`:

```tsx
import type { Duration } from '../../core/model/types';
import { NEUTRAL } from '../../core/palette/palette';

/** Simplified, kid-friendly treble clef. Units = staff spaces; origin on the G line. */
const CLEF_PATH =
  'M0.55 2.6 C0.2 2.9 0.6 3.5 1.0 3.1 C1.3 2.8 1.15 1.0 1.0 -1.0 C0.9 -2.6 1.0 -3.6 1.4 -4.4 ' +
  'C1.7 -3.6 1.6 -2.6 0.6 -1.6 C-0.3 -0.7 -0.2 0.9 0.9 1.0 C1.8 1.0 1.9 -0.2 1.2 -0.4 C0.6 -0.5 0.4 0.2 0.8 0.4';

export function TrebleClef({ x, y, spacing }: { x: number; y: number; spacing: number }) {
  return (
    <g data-kind="clef" transform={`translate(${x + spacing} ${y}) scale(${spacing})`}>
      <path d={CLEF_PATH} fill="none" stroke={NEUTRAL.ink} strokeWidth={0.22} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export interface RestGlyphProps {
  duration: Duration;
  x: number;
  y: number;
  spacing: number;
  eventIndex?: number;
}

/** Rests in staff-space units; origin = middle line at the note center. */
export function RestGlyph({ duration, x, y, spacing, eventIndex }: RestGlyphProps) {
  return (
    <g data-kind="rest" data-event-index={eventIndex} transform={`translate(${x} ${y}) scale(${spacing})`}>
      {duration === 'w' && <rect x={-0.6} y={-1} width={1.2} height={0.5} fill={NEUTRAL.ink} />}
      {duration === 'h' && <rect x={-0.6} y={-0.5} width={1.2} height={0.5} fill={NEUTRAL.ink} />}
      {duration === 'q' && (
        <path
          d="M-0.15 -1.5 L0.3 -0.85 L-0.2 -0.2 L0.3 0.45 C-0.2 0.25 -0.35 0.75 0.05 1.1"
          fill="none" stroke={NEUTRAL.ink} strokeWidth={0.22} strokeLinecap="round" strokeLinejoin="round"
        />
      )}
      {duration === 'e' && (
        <>
          <circle cx={-0.2} cy={-0.55} r={0.2} fill={NEUTRAL.ink} />
          <path d="M-0.2 -0.4 C0 -0.3 0.25 -0.45 0.35 -0.7 L-0.05 0.8" fill="none" stroke={NEUTRAL.ink} strokeWidth={0.16} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

export interface FlagGlyphProps {
  x: number;
  y: number;
  direction: 'up' | 'down';
  size: number;
  color: string;
}

/** Eighth-note flag drawn from the stem tip; mirrored for down stems. */
export function FlagGlyph({ x, y, direction, size, color }: FlagGlyphProps) {
  const sy = direction === 'up' ? size : -size;
  return (
    <g data-kind="flag" transform={`translate(${x} ${y}) scale(${size} ${sy})`}>
      <path d="M0 0 C0.1 0.9 1.0 1.2 0.8 2.2 C0.75 1.5 0.4 1.2 0 1.1 Z" fill={color} />
    </g>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/render/art/glyphs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render && git commit -m "feat(render): Chomp monster, treble clef, rest and flag glyphs"
```

---

### Task 14: Page renderer + editor cursor geometry

**Files:**
- Create: `src/core/layout/cursor.ts`, `src/render/svg/items.tsx`, `src/render/svg/PageSvg.tsx`
- Modify: `src/core/layout/index.ts` (export `cursorPosition`, `CursorPosition`)
- Test: `src/core/layout/cursor.test.ts`, `src/render/svg/PageSvg.test.tsx`

**Interfaces:**
- Consumes: layout types & `layoutSong` (Tasks 7–11), art components (Tasks 12–13), `PALETTE`, `NEUTRAL`, `PITCHES`
- Produces:
  - `interface CursorPosition { pageIndex: number; x: number; staffTop: number; spacing: number }`
  - `cursorPosition(result: LayoutResult, cursorIndex: number, spacing: number): CursorPosition` — caret just before event `cursorIndex`, or after the last event when `cursorIndex === eventCount`
  - `FONT_FAMILY = 'Helvetica, Arial, sans-serif'`
  - `LayoutItemSvg(props: { item: LayoutItem; onEventClick?: (eventIndex: number) => void }): JSX.Element`
  - `PageSvg(props: { page: PageLayout; cursor?: CursorPosition; onEventClick?: (eventIndex: number) => void; className?: string }): JSX.Element` — root `<svg>` with `viewBox` in mm and `width/height` in `mm` units (physical size for PDF; CSS may override for screen)

- [ ] **Step 1: Write the failing tests**

`src/core/layout/cursor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../model/factories';
import { cursorPosition, DEFAULT_RENDER_OPTIONS, layoutSong } from './index';

const S = DEFAULT_RENDER_OPTIONS.staffSpaceMm;

describe('cursorPosition', () => {
  it('sits at the start of an empty staff', () => {
    const result = layoutSong(createEmptySong('Empty'));
    const pos = cursorPosition(result, 0, S);
    expect(pos.pageIndex).toBe(0);
    expect(pos.x).toBeCloseTo(result.pages[0].systems[0].startX + 0.5 * S);
  });

  it('sits just before the requested event', () => {
    const song = { ...createEmptySong('Two'), events: [note('C', 4, 'q'), note('D', 4, 'q')] };
    const result = layoutSong(song);
    const slot = result.pages[0].systems[0].slots[1];
    expect(cursorPosition(result, 1, S).x).toBeCloseTo(slot.x + 0.15 * S);
  });

  it('sits after the last event when the cursor is at the end', () => {
    const song = { ...createEmptySong('Two'), events: [note('C', 4, 'q'), note('D', 4, 'q')] };
    const result = layoutSong(song);
    const system = result.pages[0].systems[0];
    const pos = cursorPosition(result, 2, S);
    expect(pos.x).toBeGreaterThan(system.slots[1].x);
    expect(pos.x).toBeLessThanOrEqual(system.endX);
  });
});
```

`src/render/svg/PageSvg.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from '../../core/model/factories';
import { DEFAULT_RENDER_OPTIONS, layoutSong, type BeamItem } from '../../core/layout';
import { LayoutItemSvg } from './items';
import { PageSvg } from './PageSvg';

const song = {
  ...createEmptySong('Fruit Salad'),
  events: [note('C', 4, 'q'), note('E', 4, 'e'), note('G', 4, 'e'), rest('q'), note('C', 5, 'q'),
    note('A', 5, 'h', true), rest('q')],
};

const count = (svg: string, needle: string) => svg.split(needle).length - 1;

describe('PageSvg', () => {
  const [page] = layoutSong(song).pages;
  const svg = renderToStaticMarkup(<PageSvg page={page} />);

  it('renders a physically sized SVG page in millimetres', () => {
    expect(svg).toContain(`viewBox="0 0 ${page.width} ${page.height}"`);
    expect(svg).toContain(`width="${page.width}mm"`);
  });

  it('draws one fruit per note, one rest glyph per rest, and a monster per system', () => {
    expect(count(svg, 'data-kind="fruit"')).toBe(5);
    expect(count(svg, 'data-kind="rest"')).toBe(2);
    expect(count(svg, 'data-kind="monster"')).toBe(page.systems.length);
  });

  it('includes the title and a 7-fruit legend', () => {
    expect(svg).toContain('>Fruit Salad</text>');
    expect(count(svg, 'data-kind="legend-entry"')).toBe(7);
  });

  it('draws the cursor when given', () => {
    const withCursor = renderToStaticMarkup(
      <PageSvg page={page} cursor={{ pageIndex: 0, x: 50, staffTop: 40, spacing: 6.5 }} />,
    );
    expect(withCursor).toContain('data-kind="cursor"');
  });

  it('renders without a legend when disabled', () => {
    const [plain] = layoutSong(song, { ...DEFAULT_RENDER_OPTIONS, showLegend: false }).pages;
    expect(renderToStaticMarkup(<PageSvg page={plain} />)).not.toContain('legend-entry');
  });
});

describe('beam rendering', () => {
  const beam: BeamItem = { kind: 'beam', x1: 10, y1: 20, x2: 30, y2: 20, thickness: 3, color: '#37474F', direction: 'up' };
  const draw = (item: BeamItem) => renderToStaticMarkup(<svg><LayoutItemSvg item={item} /></svg>);

  it('hangs an up-stem beam below the stem tips, toward the notes', () => {
    expect(draw(beam)).toContain('points="10,20 30,20 30,23 10,23"');
  });

  it('sits a down-stem beam above the stem tips, toward the notes', () => {
    expect(draw({ ...beam, direction: 'down' })).toContain('points="10,20 30,20 30,17 10,17"');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/core/layout/cursor.test.ts src/render/svg`
Expected: FAIL — `cursorPosition` not exported; cannot resolve `./PageSvg`.

- [ ] **Step 3: Implement cursor geometry**

`src/core/layout/cursor.ts`:

```ts
import type { LayoutResult } from './types';

export interface CursorPosition {
  pageIndex: number;
  x: number;
  staffTop: number;
  spacing: number;
}

export function cursorPosition(result: LayoutResult, cursorIndex: number, spacing: number): CursorPosition {
  for (const page of result.pages) {
    for (const system of page.systems) {
      const slot = system.slots.find((s) => s.eventIndex === cursorIndex);
      if (slot) return { pageIndex: page.index, x: slot.x + 0.15 * spacing, staffTop: system.staffTop, spacing };
    }
  }
  const lastPage = result.pages[result.pages.length - 1];
  const lastSystem = lastPage.systems[lastPage.systems.length - 1];
  const x = lastSystem.slots.length > 0 ? lastSystem.endX - 0.25 * spacing : lastSystem.startX + 0.5 * spacing;
  return { pageIndex: lastPage.index, x, staffTop: lastSystem.staffTop, spacing };
}
```

Append to `src/core/layout/index.ts`:

```ts
export { cursorPosition, type CursorPosition } from './cursor';
```

- [ ] **Step 4: Implement the item renderer**

`src/render/svg/items.tsx`:

```tsx
import type { LayoutItem, LegendItem } from '../../core/layout';
import { PITCHES } from '../../core/model/types';
import { NEUTRAL, PALETTE } from '../../core/palette/palette';
import { FruitArt, FruitGlyph } from '../art/fruits';
import { FlagGlyph, RestGlyph, TrebleClef } from '../art/glyphs';
import { Monster } from '../art/Monster';

export const FONT_FAMILY = 'Helvetica, Arial, sans-serif';

export interface LayoutItemSvgProps {
  item: LayoutItem;
  onEventClick?: (eventIndex: number) => void;
}

export function LayoutItemSvg({ item, onEventClick }: LayoutItemSvgProps) {
  switch (item.kind) {
    case 'staff':
      return (
        <g data-kind="staff">
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={item.x} x2={item.x + item.width}
              y1={item.y + i * item.spacing} y2={item.y + i * item.spacing}
              stroke={NEUTRAL.staff} strokeWidth={item.lineWidth} strokeLinecap="round"
            />
          ))}
        </g>
      );
    case 'monster':
      return <Monster x={item.x} y={item.y} width={item.width} height={item.height} />;
    case 'clef':
      return <TrebleClef x={item.x} y={item.y} spacing={item.spacing} />;
    case 'fruit':
      return (
        <FruitGlyph
          pitch={item.pitch} x={item.x} y={item.y} size={item.size} hollow={item.hollow}
          eventIndex={item.eventIndex} onClick={onEventClick}
        />
      );
    case 'stem':
      return <line x1={item.x} x2={item.x} y1={item.y1} y2={item.y2} stroke={item.color} strokeWidth={item.width} strokeLinecap="round" />;
    case 'flag':
      return <FlagGlyph x={item.x} y={item.y} direction={item.direction} size={item.size} color={item.color} />;
    case 'beam': {
      // y1/y2 is the stem-tip line; grow the beam toward the notes so it never sticks out past the stems
      const t = item.direction === 'up' ? item.thickness : -item.thickness;
      return (
        <polygon
          data-kind="beam"
          points={`${item.x1},${item.y1} ${item.x2},${item.y2} ${item.x2},${item.y2 + t} ${item.x1},${item.y1 + t}`}
          fill={item.color}
        />
      );
    }
    case 'ledger':
      return <line x1={item.x1} x2={item.x2} y1={item.y} y2={item.y} stroke={NEUTRAL.twig} strokeWidth={item.width} strokeLinecap="round" />;
    case 'dot':
      return <circle cx={item.x} cy={item.y} r={item.r} fill={item.color} />;
    case 'rest':
      return <RestGlyph duration={item.duration} x={item.x} y={item.y} spacing={item.spacing} eventIndex={item.eventIndex} />;
    case 'barLine':
      return item.final ? (
        <g data-kind="final-bar">
          <line x1={item.x - 3.5 * item.width} x2={item.x - 3.5 * item.width} y1={item.y1} y2={item.y2} stroke={NEUTRAL.ink} strokeWidth={item.width} />
          <line x1={item.x - 1.25 * item.width} x2={item.x - 1.25 * item.width} y1={item.y1} y2={item.y2} stroke={NEUTRAL.ink} strokeWidth={2.5 * item.width} />
        </g>
      ) : (
        <line x1={item.x} x2={item.x} y1={item.y1} y2={item.y2} stroke={NEUTRAL.ink} strokeWidth={item.width} />
      );
    case 'label':
      return (
        <text
          x={item.x} y={item.y} fontSize={item.fontSize} fill={item.color}
          textAnchor={item.anchor} fontWeight={item.weight} fontFamily={FONT_FAMILY}
        >
          {item.text}
        </text>
      );
    case 'legend':
      return <LegendSvg item={item} />;
    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
}

export function LegendSvg({ item }: { item: LegendItem }) {
  const cell = item.width / PITCHES.length;
  const fruit = Math.min(item.height * 0.45, cell * 0.5);
  const fontSize = item.height * 0.22;
  return (
    <g data-kind="legend">
      <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={3} fill="#FAFAFA" stroke="#CFD8DC" strokeWidth={0.4} />
      {PITCHES.map((pitch, i) => {
        const cx = item.x + cell * (i + 0.5);
        return (
          <g key={pitch} data-kind="legend-entry">
            <g transform={`translate(${cx} ${item.y + item.height * 0.4}) scale(${fruit})`}>
              <FruitArt pitch={pitch} hollow={false} />
            </g>
            <text
              x={cx} y={item.y + item.height * 0.88} fontSize={fontSize} textAnchor="middle"
              fontWeight="bold" fontFamily={FONT_FAMILY} fill={PALETTE[pitch].stroke}
            >
              {item.labels === 'letter' ? pitch : PALETTE[pitch].solfege}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

- [ ] **Step 5: Implement the page component**

`src/render/svg/PageSvg.tsx`:

```tsx
import type { CursorPosition, PageLayout } from '../../core/layout';
import { NEUTRAL } from '../../core/palette/palette';
import { LayoutItemSvg } from './items';

export interface PageSvgProps {
  page: PageLayout;
  cursor?: CursorPosition;
  onEventClick?: (eventIndex: number) => void;
  className?: string;
}

export function PageSvg({ page, cursor, onEventClick, className }: PageSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${page.width} ${page.height}`}
      width={`${page.width}mm`}
      height={`${page.height}mm`}
      className={className}
      role="img"
      aria-label={`Sheet music page ${page.index + 1}`}
    >
      <rect x={0} y={0} width={page.width} height={page.height} fill={NEUTRAL.paper} />
      {page.items.map((item, i) => (
        <LayoutItemSvg key={`p${i}`} item={item} />
      ))}
      {page.systems.map((system) => (
        <g key={system.index} data-kind="system">
          {system.items.map((item, i) => (
            <LayoutItemSvg key={i} item={item} onEventClick={onEventClick} />
          ))}
        </g>
      ))}
      {cursor && cursor.pageIndex === page.index && (
        <line
          data-kind="cursor"
          x1={cursor.x} x2={cursor.x}
          y1={cursor.staffTop - 1.5 * cursor.spacing} y2={cursor.staffTop + 5.5 * cursor.spacing}
          stroke="#FF4081" strokeWidth={0.18 * cursor.spacing} strokeLinecap="round"
        >
          <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
        </line>
      )}
    </svg>
  );
}
```

- [ ] **Step 6: Run to verify the tests pass**

Run: `npx vitest run src/core/layout src/render`
Expected: PASS.

- [ ] **Step 7: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test`

```bash
git add src/core/layout src/render && git commit -m "feat(render): PageSvg renderer, legend, and editor cursor geometry"
```
