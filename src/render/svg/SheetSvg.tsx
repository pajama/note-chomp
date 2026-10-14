import type { PointerEvent as ReactPointerEvent } from 'react';
import { describeEvent } from '../../core/editor/describe';
import type {
  CompactSheet,
  CompactSystem,
  CursorPosition,
  FruitItem,
  MeasureBox,
  PageHitTargets,
  RestItem,
} from '../../core/layout';
import type { MusicEvent } from '../../core/model/types';
import { LayoutItemSvg } from './items';

export const SELECTION_COLOR = '#5C6BC0';
export const PLAYING_COLOR = '#FFCA28';
export const CURSOR_COLOR = '#FF4081';
export const FLASH_COLOR = '#EF5350';

export interface SheetSvgProps {
  sheet: CompactSheet;
  targets: PageHitTargets[];
  events: MusicEvent[];
  title: string;
  /** The insert cursor; leave undefined while a note is selected. */
  cursor?: CursorPosition;
  selection: number | null;
  playing: number | null;
  /** A measure to flash (after an error). */
  flash?: MeasureBox | null;
  onNotePointerDown?: (eventIndex: number, e: ReactPointerEvent<SVGRectElement>) => void;
  onGapClick?: (index: number) => void;
}

type EventItem = FruitItem | RestItem;

function eventItem(cs: CompactSystem, eventIndex: number): EventItem | undefined {
  return cs.system.items.find(
    (item): item is EventItem =>
      (item.kind === 'fruit' || item.kind === 'rest') && item.eventIndex === eventIndex,
  );
}

/** Radius of a ring around an event: fruit by size, rests by staff spacing. */
const ringRadius = (item: EventItem) =>
  item.kind === 'fruit' ? item.size * 0.78 : item.spacing * 1.2;

function Ring({ item, kind }: { item: EventItem; kind: 'selection' | 'playing' }) {
  const r = ringRadius(item);
  return kind === 'selection' ? (
    <circle
      data-kind="selection-glow"
      data-event-index={item.eventIndex}
      cx={item.x}
      cy={item.y}
      r={r}
      fill={SELECTION_COLOR}
      fillOpacity={0.16}
      stroke={SELECTION_COLOR}
      strokeWidth={r * 0.16}
    />
  ) : (
    <circle
      data-kind="playing-halo"
      data-event-index={item.eventIndex}
      className="playing-halo"
      cx={item.x}
      cy={item.y}
      r={r * 1.15}
      fill={PLAYING_COLOR}
      fillOpacity={0.55}
    />
  );
}

/** The editor's on-screen sheet: every system stacked, width-fitted, with selection and pointer targets. */
export function SheetSvg({
  sheet,
  targets,
  events,
  title,
  cursor,
  selection,
  playing,
  flash,
  onNotePointerDown,
  onGapClick,
}: SheetSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${sheet.width} ${sheet.height}`}
      className="sheet-svg"
      role="group"
      aria-label={`${title}: sheet music`}
    >
      {sheet.systems.map((cs) => {
        const { system, pageIndex } = cs;
        const pageTargets = targets.find((t) => t.pageIndex === pageIndex);
        const notes = pageTargets?.notes.filter((t) => t.systemIndex === system.index) ?? [];
        const gaps = pageTargets?.gaps.filter((t) => t.systemIndex === system.index) ?? [];
        const selectedItem = selection === null ? undefined : eventItem(cs, selection);
        const playingItem = playing === null ? undefined : eventItem(cs, playing);
        const showCursor =
          cursor && cursor.pageIndex === pageIndex && cursor.staffTop === system.staffTop;
        const showFlash =
          flash && flash.pageIndex === pageIndex && flash.systemIndex === system.index;
        return (
          <g key={system.index} data-kind="system" transform={`translate(0 ${cs.offsetY})`}>
            {showFlash && (
              <rect
                data-kind="measure-flash"
                className="measure-flash"
                x={flash.x}
                y={flash.staffTop - flash.spacing}
                width={flash.width}
                height={6 * flash.spacing}
                rx={flash.spacing / 2}
                fill={FLASH_COLOR}
                fillOpacity={0.18}
              />
            )}
            {playingItem && <Ring item={playingItem} kind="playing" />}
            {selectedItem && <Ring item={selectedItem} kind="selection" />}
            {system.items.map((item, i) => (
              <LayoutItemSvg key={i} item={item} />
            ))}
            {showCursor && (
              <line
                data-kind="cursor"
                className="cursor-blink"
                x1={cursor.x}
                x2={cursor.x}
                y1={cursor.staffTop - 1.5 * cursor.spacing}
                y2={cursor.staffTop + 5.5 * cursor.spacing}
                stroke={CURSOR_COLOR}
                strokeWidth={0.18 * cursor.spacing}
                strokeLinecap="round"
              />
            )}
            {gaps.map((gap) => (
              <rect
                key={`g${gap.index}`}
                data-kind="gap-target"
                data-gap-index={gap.index}
                className="gap-target"
                x={gap.x}
                y={gap.y}
                width={gap.width}
                height={gap.height}
                fill="transparent"
                aria-hidden="true"
                onClick={onGapClick ? () => onGapClick(gap.index) : undefined}
              />
            ))}
            {notes.map((target) => {
              const event = events[target.eventIndex];
              if (!event) return null;
              return (
                <rect
                  key={`n${target.eventIndex}`}
                  data-kind="note-target"
                  data-event-index={target.eventIndex}
                  className="note-target"
                  x={target.x}
                  y={target.y}
                  width={target.width}
                  height={target.height}
                  fill="transparent"
                  role="button"
                  tabIndex={-1}
                  aria-label={describeEvent(event, target.eventIndex, {
                    selected: selection === target.eventIndex,
                    playing: playing === target.eventIndex,
                  })}
                  onPointerDown={
                    onNotePointerDown ? (e) => onNotePointerDown(target.eventIndex, e) : undefined
                  }
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
