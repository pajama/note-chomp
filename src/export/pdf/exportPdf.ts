import type { jsPDF } from 'jspdf';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LayoutResult } from '../../core/layout';
import { slugify } from '../../core/text';
import { PageSvg } from '../../render/svg/PageSvg';

export function pdfFileName(title: string): string {
  return `${slugify(title)}.pdf`;
}

export async function createPdf(result: LayoutResult, title: string): Promise<jsPDF> {
  // Loaded on demand: keeps the PDF libraries out of the main bundle, and svg2pdf.js's UMD build
  // cannot be imported under Node (Vitest), so it must not load when this module is imported.
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const [first] = result.pages;
  const doc = new jsPDF({
    unit: 'mm',
    format: [first.width, first.height],
    orientation: 'portrait',
  });
  doc.setProperties({ title, creator: 'Note Chomp' });

  // svg2pdf needs real DOM elements; render each page off-screen.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;';
  document.body.appendChild(host);
  try {
    for (const page of result.pages) {
      if (page.index > 0) doc.addPage([page.width, page.height], 'portrait');
      host.innerHTML = renderToStaticMarkup(createElement(PageSvg, { page }));
      const svg = host.querySelector('svg');
      if (!svg) throw new Error('Could not render the page.');
      await doc.svg(svg, { x: 0, y: 0, width: page.width, height: page.height });
    }
  } finally {
    host.remove();
  }
  return doc;
}

export async function downloadPdf(result: LayoutResult, title: string): Promise<void> {
  const doc = await createPdf(result, title);
  doc.save(pdfFileName(title));
}
