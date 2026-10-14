import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEmptySong, note, rest } from '../../core/model/factories';
import { DEFAULT_RENDER_OPTIONS, layoutSong, type BeamItem } from '../../core/layout';
import { LayoutItemSvg } from './items';
import { PageSvg } from './PageSvg';

const song = {
  ...createEmptySong('Fruit Salad'),
  events: [
    note('C', 4, 'q'),
    note('E', 4, 'e'),
    note('G', 4, 'e'),
    rest('q'),
    note('C', 5, 'q'),
    note('A', 5, 'h', true),
    rest('q'),
  ],
};

const count = (svg: string, needle: string) => svg.split(needle).length - 1;

describe('PageSvg', () => {
  const [page] = layoutSong(song).pages;
  const svg = renderToStaticMarkup(<PageSvg page={page} />);

  it('renders a physically sized SVG page in millimetres', () => {
    expect(svg).toContain(`viewBox="0 0 ${page.width} ${page.height}"`);
    expect(svg).toContain(`width="${page.width}mm"`);
  });

  it('draws one fruit per note, one rest glyph per rest, and a monster per system', () => {
    expect(count(svg, 'data-kind="fruit"')).toBe(5);
    expect(count(svg, 'data-kind="rest"')).toBe(2);
    expect(count(svg, 'data-kind="monster"')).toBe(page.systems.length);
  });

  it('includes the title and a 7-fruit legend', () => {
    expect(svg).toContain('>Fruit Salad</text>');
    expect(count(svg, 'data-kind="legend-entry"')).toBe(7);
  });

  it('draws the cursor when given', () => {
    const withCursor = renderToStaticMarkup(
      <PageSvg page={page} cursor={{ pageIndex: 0, x: 50, staffTop: 40, spacing: 6.5 }} />,
    );
    expect(withCursor).toContain('data-kind="cursor"');
    expect(withCursor).toContain('class="cursor-blink"');
    expect(withCursor).not.toContain('<animate');
  });

  it('renders without a legend when disabled', () => {
    const [plain] = layoutSong(song, { ...DEFAULT_RENDER_OPTIONS, showLegend: false }).pages;
    expect(renderToStaticMarkup(<PageSvg page={plain} />)).not.toContain('legend-entry');
  });
});

describe('beam rendering', () => {
  const beam: BeamItem = {
    kind: 'beam',
    x1: 10,
    y1: 20,
    x2: 30,
    y2: 20,
    thickness: 3,
    color: '#37474F',
    direction: 'up',
  };
  const draw = (item: BeamItem) =>
    renderToStaticMarkup(
      <svg>
        <LayoutItemSvg item={item} />
      </svg>,
    );

  it('hangs an up-stem beam below the stem tips, toward the notes', () => {
    expect(draw(beam)).toContain('points="10,20 30,20 30,23 10,23"');
  });

  it('sits a down-stem beam above the stem tips, toward the notes', () => {
    expect(draw({ ...beam, direction: 'down' })).toContain('points="10,20 30,20 30,17 10,17"');
  });
});
