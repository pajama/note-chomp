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
      <path
        d="M30 26 L24 6 L42 20 Z"
        fill={HORN}
        stroke={BODY_DARK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M56 20 L68 4 L69 24 Z"
        fill={HORN}
        stroke={BODY_DARK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M48 62 L84.5 37.4 A44 44 0 1 0 84.5 86.6 Z"
        fill={BODY}
        stroke={BODY_DARK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <ellipse cx={38} cy={80} rx={20} ry={16} fill={BELLY} />
      <ellipse cx={64} cy={64} rx={9} ry={4.5} fill={TONGUE} />
      <path
        d="M67.4 48.9 L72.4 45.6 L73.25 52.2 Z"
        fill="#FFFFFF"
        stroke={BODY_DARK}
        strokeWidth={1}
      />
      <path
        d="M75.4 43.5 L80.4 40.2 L81.3 46.8 Z"
        fill="#FFFFFF"
        stroke={BODY_DARK}
        strokeWidth={1}
      />
      <path
        d="M71.06 77.54 L76.04 80.9 L76.9 74.24 Z"
        fill="#FFFFFF"
        stroke={BODY_DARK}
        strokeWidth={1}
      />
      <circle cx={46} cy={36} r={11} fill="#FFFFFF" stroke={BODY_DARK} strokeWidth={2} />
      <circle cx={50} cy={36} r={5.5} fill={INK} />
      <circle cx={52} cy={34} r={1.8} fill="#FFFFFF" />
    </g>
  );
}
