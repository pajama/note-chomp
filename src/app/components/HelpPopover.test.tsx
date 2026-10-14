import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_LINES, HelpPopover } from './HelpPopover';

describe('HelpPopover', () => {
  it('starts closed: just a labelled "?" button', () => {
    const html = renderToStaticMarkup(<HelpPopover />);
    expect(html).toContain('aria-label="Help"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });

  it('covers every way of editing and playing', () => {
    const text = HELP_LINES.join(' ');
    for (const words of ['C–B', 'drag', '← →', 'Shift', 'Backspace', 'Esc', 'Space plays']) {
      expect(text).toContain(words);
    }
  });
});
