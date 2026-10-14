import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Toast } from './Toast';

describe('Toast', () => {
  it('always renders the polite live region', () => {
    const html = renderToStaticMarkup(<Toast message={null} onDismiss={() => {}} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('data-testid="toast"');
  });

  it('shows the message with its tone and an OK button', () => {
    const html = renderToStaticMarkup(
      <Toast message={{ id: 1, text: 'Saved!', tone: 'info' }} onDismiss={() => {}} />,
    );
    expect(html).toContain('class="toast info"');
    expect(html).toContain('Saved!');
    expect(html).toContain('>OK</button>');
  });
});
