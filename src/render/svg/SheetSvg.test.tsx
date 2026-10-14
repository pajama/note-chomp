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
    expect(count(svg, 'tabindex="-1"')).toBe(4);
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

  it('blinks the cursor with CSS (so reduced motion can stop it), not SMIL', () => {
    const svg = render({ cursor: cursorPosition(layout, 2, s) });
    expect(svg).toContain('class="cursor-blink"');
    expect(svg).not.toContain('<animate');
  });

  it('flashes a measure', () => {
    expect(render({ flash: measureBox(layout, 1) })).toContain('data-kind="measure-flash"');
  });
});
