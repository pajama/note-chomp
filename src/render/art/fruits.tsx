import type { ReactElement } from 'react';
import type { Pitch } from '../../core/model/types';
import { NEUTRAL, PALETTE, type FruitKind, type PaletteEntry } from '../../core/palette/palette';

/** Outline widths in unit-box units (1 = the fruit's box, which is 1.2 staff spaces on paper). */
export const SOLID_OUTLINE = 0.075;
export const HOLLOW_OUTLINE = 0.1;
const LEAF_OUTLINE = 0.03;
const STALK_WIDTH = 0.065;
/** Grapes and raspberry drupelets: many small circles, so one width for solid and hollow. */
const BERRY_OUTLINE = 0.07;

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeLinejoin: 'round';
}

function bodyPaint(entry: PaletteEntry, hollow: boolean): Paint {
  return hollow
    ? {
        fill: entry.tint,
        stroke: entry.color,
        strokeWidth: HOLLOW_OUTLINE,
        strokeLinejoin: 'round',
      }
    : {
        fill: entry.color,
        stroke: entry.stroke,
        strokeWidth: SOLID_OUTLINE,
        strokeLinejoin: 'round',
      };
}

function Leaf({
  cx,
  cy,
  rotate,
  rx = 0.13,
  ry = 0.065,
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
      strokeWidth={LEAF_OUTLINE}
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
      strokeWidth={STALK_WIDTH}
      strokeLinecap="butt"
    />
  );
}

/** Glossy highlight: a tilted white oval toward the upper left. Solid fruit only. */
function Shine({
  cx,
  cy,
  rx,
  ry,
  rotate = 25,
  hollow,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate?: number;
  hollow: boolean;
}) {
  if (hollow) return null;
  return (
    <ellipse
      data-part="shine"
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      transform={`rotate(${rotate} ${cx} ${cy})`}
      fill="#FFFFFF"
      opacity={0.6}
    />
  );
}

/** Tiny friendly face (two dot eyes + a small smile), drawn in the darker stroke color. Solid fruit only. */
function Face({
  cx,
  cy,
  color,
  hollow,
  scale = 1,
}: {
  cx: number;
  cy: number;
  color: string;
  hollow: boolean;
  scale?: number;
}) {
  if (hollow) return null;
  return (
    <g data-part="face" transform={`translate(${cx} ${cy}) scale(${scale})`}>
      <circle cx={-0.1} cy={-0.03} r={0.038} fill={color} />
      <circle cx={0.1} cy={-0.03} r={0.038} fill={color} />
      <path
        d="M-0.075 0.05 Q0 0.13 0.075 0.05"
        fill="none"
        stroke={color}
        strokeWidth={0.032}
        strokeLinecap="round"
      />
    </g>
  );
}

type ShapeFn = (paint: Paint, entry: PaletteEntry, hollow: boolean) => ReactElement;

const BLUEBERRY_CROWN =
  '0,-0.4 0.035,-0.33 0.11,-0.32 0.055,-0.27 0.07,-0.2 0,-0.235 -0.07,-0.2 -0.055,-0.27 -0.11,-0.32 -0.035,-0.33';

const GRAPES: [number, number][] = [
  [-0.27, -0.2],
  [-0.09, -0.22],
  [0.09, -0.22],
  [0.27, -0.2],
  [-0.18, 0.03],
  [0.18, 0.03],
  [-0.09, 0.26],
  [0.09, 0.26],
  // front and center: carries the face, drawn last
  [0, 0.03],
];
const GRAPE_R = 0.15;

/** Drupelet rows, back (top) to front (bottom). */
const DRUPELETS: [number, number][] = [
  [-0.24, -0.2],
  [-0.08, -0.22],
  [0.08, -0.22],
  [0.24, -0.2],
  [-0.32, -0.03],
  [-0.16, -0.03],
  [0, -0.03],
  [0.16, -0.03],
  [0.32, -0.03],
  [-0.24, 0.14],
  [-0.08, 0.14],
  [0.08, 0.14],
  [0.24, 0.14],
  [-0.16, 0.3],
  [0, 0.31],
  [0.16, 0.3],
];
const DRUPELET_R = 0.1;

const SHAPES: Record<FruitKind, ShapeFn> = {
  apple: (p, e, hollow) => (
    <>
      <Stalk x1={0} y1={-0.27} x2={0.03} y2={-0.46} />
      <path
        d="M0 -0.27 C0.2 -0.43 0.49 -0.36 0.47 0 C0.46 0.3 0.24 0.46 0 0.39 C-0.24 0.46 -0.46 0.3 -0.47 0 C-0.49 -0.36 -0.2 -0.43 0 -0.27 Z"
        {...p}
      />
      <Leaf cx={0.17} cy={-0.38} rotate={-30} />
      <Shine cx={-0.25} cy={-0.12} rx={0.07} ry={0.12} hollow={hollow} />
      <Face cx={0.02} cy={0.1} color={e.stroke} hollow={hollow} />
    </>
  ),
  orange: (p, e, hollow) => (
    <>
      <circle cx={0} cy={0.02} r={0.43} {...p} />
      {[
        [0.27, -0.18],
        [0.32, 0.06],
        [0.2, 0.3],
      ].map(([cx, cy]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={0.022} fill={e.stroke} opacity={0.45} />
      ))}
      <Leaf cx={0.11} cy={-0.4} rotate={-20} />
      <Shine cx={-0.23} cy={-0.13} rx={0.06} ry={0.11} hollow={hollow} />
      <Face cx={0} cy={0.1} color={e.stroke} hollow={hollow} />
    </>
  ),
  lemon: (p, e, hollow) => (
    <>
      <path
        d="M-0.5 0 C-0.45 -0.05 -0.42 -0.42 0 -0.42 C0.42 -0.42 0.45 -0.05 0.5 0 C0.45 0.05 0.42 0.42 0 0.42 C-0.42 0.42 -0.45 0.05 -0.5 0 Z"
        {...p}
      />
      <Shine cx={-0.2} cy={-0.18} rx={0.12} ry={0.05} rotate={-10} hollow={hollow} />
      <Face cx={0.02} cy={0.06} color={e.stroke} hollow={hollow} />
    </>
  ),
  pear: (p, e, hollow) => (
    <>
      <Stalk x1={0} y1={-0.39} x2={0.04} y2={-0.47} />
      <path
        d="M0 -0.4 C0.13 -0.4 0.16 -0.26 0.19 -0.14 C0.24 0 0.45 0.08 0.44 0.25 C0.43 0.42 0.22 0.45 0 0.45 C-0.22 0.45 -0.43 0.42 -0.44 0.25 C-0.45 0.08 -0.24 0 -0.19 -0.14 C-0.16 -0.26 -0.13 -0.4 0 -0.4 Z"
        {...p}
      />
      <Leaf cx={0.15} cy={-0.39} rotate={-30} rx={0.12} ry={0.06} />
      <Shine cx={-0.22} cy={0.1} rx={0.05} ry={0.1} rotate={15} hollow={hollow} />
      <Face cx={0.02} cy={0.22} color={e.stroke} hollow={hollow} />
    </>
  ),
  blueberry: (p, e, hollow) => (
    <>
      <circle cx={0} cy={0} r={0.44} {...p} />
      <polygon
        points={BLUEBERRY_CROWN}
        fill={hollow ? e.color : e.stroke}
        stroke={hollow ? e.color : e.stroke}
        strokeWidth={0.02}
        strokeLinejoin="round"
      />
      <Shine cx={-0.24} cy={-0.1} rx={0.06} ry={0.11} hollow={hollow} />
      <Face cx={0.02} cy={0.1} color={e.stroke} hollow={hollow} />
    </>
  ),
  grape: (p, e, hollow) => (
    <>
      <Stalk x1={0} y1={-0.36} x2={0.04} y2={-0.47} />
      <Leaf cx={0.17} cy={-0.4} rotate={-20} rx={0.12} ry={0.06} />
      {GRAPES.map(([cx, cy]) => (
        <g key={`${cx},${cy}`}>
          <circle
            cx={cx}
            cy={cy}
            r={GRAPE_R}
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth={BERRY_OUTLINE}
          />
          {!hollow && (cx !== 0 || cy !== 0.03) && (
            <circle cx={cx - 0.05} cy={cy - 0.05} r={0.03} fill="#FFFFFF" opacity={0.55} />
          )}
        </g>
      ))}
      <Face cx={0} cy={0.04} color={e.stroke} hollow={hollow} scale={0.75} />
    </>
  ),
  raspberry: (p, e, hollow) => (
    <>
      {DRUPELETS.map(([cx, cy]) => (
        <circle
          key={`${cx},${cy}`}
          cx={cx}
          cy={cy}
          r={DRUPELET_R}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={BERRY_OUTLINE}
        />
      ))}
      {!hollow && <ellipse cx={0} cy={0.08} rx={0.17} ry={0.13} fill={p.fill} />}
      <Leaf cx={-0.12} cy={-0.33} rotate={20} rx={0.11} ry={0.05} />
      <Leaf cx={0.12} cy={-0.33} rotate={-20} rx={0.11} ry={0.05} />
      <Leaf cx={0} cy={-0.36} rotate={90} rx={0.09} ry={0.045} />
      <Face cx={0} cy={0.06} color={e.stroke} hollow={hollow} scale={0.85} />
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
