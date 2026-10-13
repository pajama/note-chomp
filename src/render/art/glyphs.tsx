import type { Duration } from '../../core/model/types';
import { NEUTRAL } from '../../core/palette/palette';

/** Simplified, kid-friendly treble clef. Units = staff spaces; origin on the G line. */
const CLEF_PATH =
  'M0.55 2.6 C0.2 2.9 0.6 3.5 1.0 3.1 C1.3 2.8 1.15 1.0 1.0 -1.0 C0.9 -2.6 1.0 -3.6 1.4 -4.4 ' +
  'C1.7 -3.6 1.6 -2.6 0.6 -1.6 C-0.3 -0.7 -0.2 0.9 0.9 1.0 C1.8 1.0 1.9 -0.2 1.2 -0.4 C0.6 -0.5 0.4 0.2 0.8 0.4';

export function TrebleClef({ x, y, spacing }: { x: number; y: number; spacing: number }) {
  return (
    <g data-kind="clef" transform={`translate(${x + spacing} ${y}) scale(${spacing})`}>
      <path
        d={CLEF_PATH}
        fill="none"
        stroke={NEUTRAL.ink}
        strokeWidth={0.22}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    <g
      data-kind="rest"
      data-event-index={eventIndex}
      transform={`translate(${x} ${y}) scale(${spacing})`}
    >
      {duration === 'w' && <rect x={-0.6} y={-1} width={1.2} height={0.5} fill={NEUTRAL.ink} />}
      {duration === 'h' && <rect x={-0.6} y={-0.5} width={1.2} height={0.5} fill={NEUTRAL.ink} />}
      {duration === 'q' && (
        <path
          d="M-0.15 -1.5 L0.3 -0.85 L-0.2 -0.2 L0.3 0.45 C-0.2 0.25 -0.35 0.75 0.05 1.1"
          fill="none"
          stroke={NEUTRAL.ink}
          strokeWidth={0.22}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {duration === 'e' && (
        <>
          <circle cx={-0.2} cy={-0.55} r={0.2} fill={NEUTRAL.ink} />
          <path
            d="M-0.2 -0.4 C0 -0.3 0.25 -0.45 0.35 -0.7 L-0.05 0.8"
            fill="none"
            stroke={NEUTRAL.ink}
            strokeWidth={0.16}
            strokeLinecap="round"
          />
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
