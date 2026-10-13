# Phase 4c — Render: SheetSvg & note descriptions (Task 13)

From here on every task also runs the e2e suite (sandbox disabled for that command; port 5179 free).

### Task 13: SheetSvg & note descriptions

**Files:**
- Create: `src/core/editor/describe.ts`, `src/render/svg/SheetSvg.tsx`
- Test: `src/core/editor/describe.test.ts`, `src/render/svg/SheetSvg.test.tsx`

**Interfaces:**
- Consumes: `durationName` (`src/core/theory/rhythm.ts`: "quarter note", "dotted half rest"); Task 3/4 types from the `src/core/layout` barrel (`CompactSheet`, `CompactSystem`, `PageHitTargets`, `MeasureBox`, `CursorPosition`, `FruitItem`, `RestItem`); `LayoutItemSvg` (`src/render/svg/items.tsx`).
- Produces (used by Tasks 14, 16, 18):
  - `describeEvent(event: MusicEvent, index: number, flags?: { selected?: boolean; playing?: boolean }): string` — `"Note 3: G, quarter note"`, `"Note 4: eighth rest"`, plus `", selected"` / `", playing"`.
  - `SELECTION_COLOR = '#5C6BC0'`, `PLAYING_COLOR = '#FFCA28'`, `CURSOR_COLOR = '#FF4081'`, `FLASH_COLOR = '#EF5350'`
  - `<SheetSvg sheet targets events title cursor? selection playing flash? onNotePointerDown? onGapClick? />` (`SheetSvgProps`): one `<svg class="sheet-svg" role="group" aria-label="{title}: sheet music">` with each system in `<g data-kind="system" transform="translate(0 offsetY)">`, drawn back to front: measure flash (`data-kind="measure-flash"`), playing halo (`data-kind="playing-halo"`, `data-event-index`), selection glow (`data-kind="selection-glow"`, `data-event-index`), the system items, the cursor (`data-kind="cursor"`, only if `cursor` is given and on this system), then transparent gap targets (`data-kind="gap-target"`, `data-gap-index`, `aria-hidden`, click → `onGapClick(index)`) and note targets (`data-kind="note-target"`, `data-event-index`, `role="button"`, `aria-label` from `describeEvent`, pointerdown → `onNotePointerDown(eventIndex, event)`).

- [ ] **Step 1: Write the failing tests**

**Create `src/core/editor/describe.test.ts`:**

```ts
import { describe, expect, it } from 'vitest';
import { note, rest } from '../model/factories';
import { describeEvent } from './describe';

describe('describeEvent', () => {
  it('names notes by letter and length, counting from 1', () => {
    expect(describeEvent(note('G', 4, 'q'), 2)).toBe('Note 3: G, quarter note');
    expect(describeEvent(note('C', 5, 'h', true), 0)).toBe('Note 1: C, dotted half note');
  });
  it('names rests by length', () => {
    expect(describeEvent(rest('e'), 3)).toBe('Note 4: eighth rest');
  });
  it('adds selected and playing', () => {
    expect(describeEvent(note('E', 4, 'w'), 0, { selected: true })).toBe(
      'Note 1: E, whole note, selected',
    );
    expect(describeEvent(note('E', 4, 'w'), 0, { selected: true, playing: true })).toBe(
      'Note 1: E, whole note, selected, playing',
    );
  });
});
```

**Create `src/render/svg/SheetSvg.test.tsx`:**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  compactSheet,
  cursorPosition,
  DEFAULT_RENDER_OPTIONS,
  editorHitTargets,
  layoutSong,
  measureBox,
} from '../../core/layout';
import { createEmptySong, note, rest } from '../../core/model/factories';
import { SheetSvg, type SheetSvgProps } from './SheetSvg';

const s = DEFAULT_RENDER_OPTIONS.staffSpaceMm;
const song = {
  ...createEmptySong('Snack'),
  events: [note('C', 4, 'q'), note('E', 4, 'q'), rest('q'), note('G', 4, 'q')],
};
const layout = layoutSong(song);
const base: SheetSvgProps = {
  sheet: compactSheet(layout, s),
  targets: editorHitTargets(layout),
  events: song.events,
  title: song.title,
  selection: null,
  playing: null,
};
const render = (props: Partial<SheetSvgProps> = {}) =>
  renderToStaticMarkup(<SheetSvg {...base} {...props} />);
const count = (svg: string, needle: string) => svg.split(needle).length - 1;

describe('SheetSvg', () => {
  it('draws the systems without a page, title or legend', () => {
    const svg = render();
    expect(svg).toContain(`viewBox="0 0 ${base.sheet.width} ${base.sheet.height}"`);
    expect(count(svg, 'data-kind="fruit"')).toBe(3);
    expect(svg).not.toContain('legend-entry');
    expect(svg).not.toContain('>Snack</text>');
    expect(svg).toContain('aria-label="Snack: sheet music"');
  });

  it('adds a labelled button per event and a gap target per gap', () => {
    const svg = render();
    expect(count(svg, 'data-kind="note-target"')).toBe(4);
    expect(count(svg, 'role="button"')).toBe(4);
    expect(svg).toContain('aria-label="Note 1: C, quarter note"');
    expect(svg).toContain('aria-label="Note 3: quarter rest"');
    expect(count(svg, 'data-kind="gap-target"')).toBe(5);
  });

  it('marks the selected and the playing event', () => {
    const svg = render({ selection: 1, playing: 3 });
    expect(svg).toContain('data-kind="selection-glow" data-event-index="1"');
    expect(svg).toContain('data-kind="playing-halo" data-event-index="3"');
    expect(svg).toContain('aria-label="Note 2: E, quarter note, selected"');
    expect(svg).toContain('aria-label="Note 4: G, quarter note, playing"');
  });

  it('shows the cursor only when given one', () => {
    expect(render()).not.toContain('data-kind="cursor"');
    const cursor = cursorPosition(layout, 2, s);
    expect(render({ cursor })).toContain('data-kind="cursor"');
  });

  it('flashes a measure', () => {
    expect(render({ flash: measureBox(layout, 1) })).toContain('data-kind="measure-flash"');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `timeout 120 npx vitest run src/core/editor/describe.test.ts src/render/svg/SheetSvg.test.tsx`
Expected: FAIL — `Failed to resolve import "./describe"` / `"./SheetSvg"`.

- [ ] **Step 3: Implement**

**Create `src/core/editor/describe.ts`:**

```ts
import type { MusicEvent } from '../model/types';
import { durationName } from '../theory/rhythm';

export interface DescribeFlags {
  selected?: boolean;
  playing?: boolean;
}

/** Screen-reader name for event `index`: "Note 3: G, quarter note", "Note 4: half rest, selected". */
export function describeEvent(event: MusicEvent, index: number, flags: DescribeFlags = {}): string {
  const what =
    event.kind === 'note' ? `${event.pitch}, ${durationName(event)}` : durationName(event);
  const extras = [flags.selected ? 'selected' : '', flags.playing ? 'playing' : ''].filter(Boolean);
  return [`Note ${index + 1}: ${what}`, ...extras].join(', ');
}
```

**Create `src/render/svg/SheetSvg.tsx`:**

```tsx
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
                x1={cursor.x}
                x2={cursor.x}
                y1={cursor.staffTop - 1.5 * cursor.spacing}
                y2={cursor.staffTop + 5.5 * cursor.spacing}
                stroke={CURSOR_COLOR}
                strokeWidth={0.18 * cursor.spacing}
                strokeLinecap="round"
              >
                <animate
                  attributeName="opacity"
                  values="1;0.2;1"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </line>
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `timeout 120 npx vitest run src/core/editor src/render`
Expected: PASS (3 + 5 new tests; existing render tests unchanged).

- [ ] **Step 5: Verify everything and commit**

```bash
npm run format && npm run lint && npm run typecheck && timeout 300 npm test
timeout 600 npm run test:e2e   # sandbox disabled
git add src/core/editor/describe.ts src/core/editor/describe.test.ts src/render/svg/SheetSvg.tsx src/render/svg/SheetSvg.test.tsx
git commit -m "feat(render): compact editor sheet with selection, playback and pointer targets"
```
