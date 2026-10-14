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
          className="cursor-blink"
          x1={cursor.x}
          x2={cursor.x}
          y1={cursor.staffTop - 1.5 * cursor.spacing}
          y2={cursor.staffTop + 5.5 * cursor.spacing}
          stroke="#FF4081"
          strokeWidth={0.18 * cursor.spacing}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
