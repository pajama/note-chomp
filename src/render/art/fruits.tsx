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

function Leaf({
  cx,
  cy,
  rotate,
  rx = 0.12,
  ry = 0.06,
}: {
  cx: number;
  cy: number;
  rotate: number;
  rx?: number;
  ry?: number;
}) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      transform={`rotate(${rotate} ${cx} ${cy})`}
      fill={NEUTRAL.leaf}
      stroke={NEUTRAL.leafStroke}
      strokeWidth={0.025}
    />
  );
}

function Stalk({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={NEUTRAL.fruitStem}
      strokeWidth={0.06}
      strokeLinecap="butt"
    />
  );
}

function Shine({
  cx,
  cy,
  rx,
  ry,
  hollow,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  hollow: boolean;
}) {
  if (hollow) return null;
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFFFFF" opacity={0.45} />;
}

type ShapeFn = (paint: Paint, entry: PaletteEntry, hollow: boolean) => ReactElement;

const BLUEBERRY_CROWN =
  '0,-0.36 0.0265,-0.2964 0.0951,-0.2909 0.0428,-0.2461 0.0588,-0.1791 0,-0.215 -0.0588,-0.1791 -0.0428,-0.2461 -0.0951,-0.2909 -0.0265,-0.2964';

const GRAPES: [number, number][] = [
  [-0.2, -0.22],
  [0, -0.22],
  [0.2, -0.22],
  [-0.1, 0.02],
  [0.1, 0.02],
  [0, 0.26],
];

const DRUPELETS: [number, number][] = [
  [-0.2, -0.12],
  [0, -0.15],
  [0.2, -0.12],
  [-0.25, 0.08],
  [-0.08, 0.06],
  [0.08, 0.06],
  [0.25, 0.08],
  [-0.14, 0.25],
  [0.04, 0.27],
  [0.19, 0.22],
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
      {[
        [-0.15, 0.08],
        [0.16, 0.12],
        [0, 0.24],
        [0.12, -0.14],
        [-0.2, -0.12],
      ].map(([cx, cy]) => (
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
        <circle
          key={`${cx},${cy}`}
          cx={cx}
          cy={cy}
          r={0.155}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth * 0.7}
        />
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
        <circle
          key={`${cx},${cy}`}
          cx={cx}
          cy={cy}
          r={0.07}
          fill="none"
          stroke={e.stroke}
          strokeWidth={0.025}
        />
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
