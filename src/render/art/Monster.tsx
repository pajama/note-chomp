const BODY = '#5C6BC0';
const SPOT = '#3F51B5';
const OUTLINE = '#1A237E';
const MOUTH = '#2A1B3D';
const HORN = '#FFF1D6';
const TONGUE = '#F06292';
const TOOTH = '#FFFFFF';
const INK = '#1A1A2E';

/** Mouth hinge and jaw tips: the body is a circle (center 50,64, r 42) with a wedge cut out to the right. */
export const MONSTER_MOUTH = {
  hinge: [50, 64],
  upperJaw: [84.8, 40.5],
  lowerJaw: [84.8, 87.5],
} as const;

/** Small triangles along a jaw edge, pointing into the mouth. */
const UPPER_TEETH = [
  'M60.1 58.6 L66.1 54.6 L66.6 61.7 Z',
  'M66.7 54.1 L72.7 50.1 L73.2 57.3 Z',
  'M73.4 49.7 L79.3 45.6 L79.8 52.8 Z',
];
const LOWER_TEETH = ['M67.6 74.4 L73.5 78.5 L74.0 71.3 Z', 'M74.2 78.9 L80.2 82.9 L80.7 75.8 Z'];

/** Chomp the monster. Drawn in a 100 × 120 box; mouth (wedge) opens to the right. */
export function Monster({ x, y, width }: { x: number; y: number; width: number; height: number }) {
  const outline = { stroke: OUTLINE, strokeWidth: 3.5, strokeLinejoin: 'round' as const };
  return (
    <g data-kind="monster" transform={`translate(${x} ${y}) scale(${width / 100})`}>
      {/* feet */}
      <ellipse cx={34} cy={106} rx={11} ry={7.5} fill={BODY} {...outline} />
      <ellipse cx={63} cy={106} rx={11} ry={7.5} fill={BODY} {...outline} />
      {/* horns */}
      <path d="M21 36 C16 26 16 17 21 9 C27 15 33 20 38 25 Z" fill={HORN} {...outline} />
      <path d="M60 23 C65 17 70 13 76 8 C78 16 78 23 75 30 Z" fill={HORN} {...outline} />
      {/* dark throat behind the jaws, then the body with the mouth wedge cut out */}
      <path d="M48 64 L84.8 40.5 Q79 64 84.8 87.5 Z" fill={MOUTH} />
      <path d="M50 64 L84.8 40.5 A42 42 0 1 0 84.8 87.5 Z" fill={BODY} {...outline} />
      {/* spots */}
      <circle cx={19} cy={66} r={4.5} fill={SPOT} opacity={0.55} />
      <circle cx={25} cy={77} r={3.2} fill={SPOT} opacity={0.55} />
      <circle cx={16} cy={78} r={2.4} fill={SPOT} opacity={0.55} />
      <circle cx={29} cy={89} r={2.8} fill={SPOT} opacity={0.55} />
      {/* tongue on the lower jaw, teeth along both jaws */}
      <path
        d="M55.5 64.8 C60 62 66.5 62.8 71 67.5 C72 70.5 69 72.5 65.5 71.3 C61 69.7 58 67.5 55.5 64.8 Z"
        fill={TONGUE}
      />
      {[...UPPER_TEETH, ...LOWER_TEETH].map((d) => (
        <path key={d} d={d} fill={TOOTH} stroke={MOUTH} strokeWidth={0.8} strokeLinejoin="round" />
      ))}
      {/* big eye */}
      <circle cx={47} cy={37} r={13.5} fill="#FFFFFF" {...outline} />
      <circle cx={51} cy={38} r={8} fill={INK} />
      <circle cx={54} cy={34.5} r={2.8} fill="#FFFFFF" />
      <circle cx={48.5} cy={41.5} r={1.2} fill="#FFFFFF" />
    </g>
  );
}
