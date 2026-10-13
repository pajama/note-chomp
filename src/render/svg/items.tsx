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
              x1={item.x}
              x2={item.x + item.width}
              y1={item.y + i * item.spacing}
              y2={item.y + i * item.spacing}
              stroke={NEUTRAL.staff}
              strokeWidth={item.lineWidth}
              strokeLinecap="round"
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
          pitch={item.pitch}
          x={item.x}
          y={item.y}
          size={item.size}
          hollow={item.hollow}
          eventIndex={item.eventIndex}
          onClick={onEventClick}
        />
      );
    case 'stem':
      return (
        <line
          x1={item.x}
          x2={item.x}
          y1={item.y1}
          y2={item.y2}
          stroke={item.color}
          strokeWidth={item.width}
          strokeLinecap="round"
        />
      );
    case 'flag':
      return (
        <FlagGlyph
          x={item.x}
          y={item.y}
          direction={item.direction}
          size={item.size}
          color={item.color}
        />
      );
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
      return (
        <line
          x1={item.x1}
          x2={item.x2}
          y1={item.y}
          y2={item.y}
          stroke={NEUTRAL.twig}
          strokeWidth={item.width}
          strokeLinecap="round"
        />
      );
    case 'dot':
      return <circle cx={item.x} cy={item.y} r={item.r} fill={item.color} />;
    case 'rest':
      return (
        <RestGlyph
          duration={item.duration}
          x={item.x}
          y={item.y}
          spacing={item.spacing}
          eventIndex={item.eventIndex}
        />
      );
    case 'barLine':
      return item.final ? (
        <g data-kind="final-bar">
          <line
            x1={item.x - 3.5 * item.width}
            x2={item.x - 3.5 * item.width}
            y1={item.y1}
            y2={item.y2}
            stroke={NEUTRAL.ink}
            strokeWidth={item.width}
          />
          <line
            x1={item.x - 1.25 * item.width}
            x2={item.x - 1.25 * item.width}
            y1={item.y1}
            y2={item.y2}
            stroke={NEUTRAL.ink}
            strokeWidth={2.5 * item.width}
          />
        </g>
      ) : (
        <line
          x1={item.x}
          x2={item.x}
          y1={item.y1}
          y2={item.y2}
          stroke={NEUTRAL.ink}
          strokeWidth={item.width}
        />
      );
    case 'label':
      return (
        <text
          x={item.x}
          y={item.y}
          fontSize={item.fontSize}
          fill={item.color}
          textAnchor={item.anchor}
          fontWeight={item.weight}
          fontFamily={FONT_FAMILY}
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
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rx={3}
        fill="#FAFAFA"
        stroke="#CFD8DC"
        strokeWidth={0.4}
      />
      {PITCHES.map((pitch, i) => {
        const cx = item.x + cell * (i + 0.5);
        return (
          <g key={pitch} data-kind="legend-entry">
            <g transform={`translate(${cx} ${item.y + item.height * 0.4}) scale(${fruit})`}>
              <FruitArt pitch={pitch} hollow={false} />
            </g>
            <text
              x={cx}
              y={item.y + item.height * 0.88}
              fontSize={fontSize}
              textAnchor="middle"
              fontWeight="bold"
              fontFamily={FONT_FAMILY}
              fill={PALETTE[pitch].stroke}
            >
              {item.labels === 'letter' ? pitch : PALETTE[pitch].solfege}
            </text>
          </g>
        );
      })}
    </g>
  );
}
