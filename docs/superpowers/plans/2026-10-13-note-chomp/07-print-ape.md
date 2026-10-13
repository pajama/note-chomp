# Phase 7 — Print & PDF, APE concept art, visual review

### Task 26: Print preview & vector PDF export

**Files:**
- Create: `src/export/pdf/exportPdf.ts`, `src/export/pdf/exportPdf.test.ts`, `e2e/print.spec.ts`
- Modify: `src/app/pages/PrintPage.tsx` (replace stub), `src/app/styles.css` (append)

**Interfaces:**
- Consumes: `LayoutResult`, `layoutSong`, `RenderOptions`, `DEFAULT_RENDER_OPTIONS`, `STAFF_SIZES` (11); `PageSvg` (14); `slugify` (22); `SongPages` (23); `useSongLibrary`, `messageOf`, `routeToHash` (22)
- Produces:
  - `pdfFileName(title: string): string` → `"<slug>.pdf"`
  - `createPdf(result: LayoutResult, title: string): Promise<jsPDF>` — one PDF page per layout page, page size = layout page size in mm, vector drawing via svg2pdf.js
  - `downloadPdf(result: LayoutResult, title: string): Promise<void>`
  - `PrintPage({ songId }: { songId: string })` — options panel (Paper, Staff size, Labels, Fruit legend, Treble clef, Measure numbers, Bigger fruit for longer notes), live preview, "Download PDF" (busy state + retry on error), "Print" (browser print with print CSS)

- [ ] **Step 1: Write the failing unit test**

`src/export/pdf/exportPdf.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pdfFileName } from './exportPdf';

describe('pdfFileName', () => {
  it('slugifies the title', () => {
    expect(pdfFileName('Twinkle Twinkle Little Star')).toBe('twinkle-twinkle-little-star.pdf');
    expect(pdfFileName('???')).toBe('song.pdf');
  });
});
```

- [ ] **Step 2: Write the failing e2e test**

`e2e/print.spec.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function downloadPdf(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  const file = await download.path();
  return { name: download.suggestedFilename(), text: (await readFile(file)).toString('latin1') };
}

const pageCount = (pdf: string) => (pdf.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

test('exports Hot Cross Buns as a one-page vector PDF', async ({ page }) => {
  await page.goto('/#/print/builtin-hot-cross-buns');
  await expect(page.locator('.page-svg')).toHaveCount(1);
  const pdf = await downloadPdf(page);
  expect(pdf.name).toBe('hot-cross-buns.pdf');
  expect(pdf.text.startsWith('%PDF-')).toBe(true);
  expect(pageCount(pdf.text)).toBe(1);
  expect(pdf.text).not.toContain('/Subtype /Image');
});

test('PDF pages follow the preview when the staff gets bigger', async ({ page }) => {
  await page.goto('/#/print/builtin-jingle-bells');
  await page.getByLabel('Staff size').selectOption({ label: 'Jumbo' });
  const previewPages = await page.locator('.page-svg').count();
  expect(previewPages).toBeGreaterThan(1);
  const pdf = await downloadPdf(page);
  expect(pageCount(pdf.text)).toBe(previewPages);
});

test('preview responds to label and legend options', async ({ page }) => {
  await page.goto('/#/print/builtin-hot-cross-buns');
  await page.getByLabel('Labels').selectOption('solfege');
  await expect(page.locator('.page-svg text', { hasText: 'Mi' }).first()).toBeVisible();
  await page.getByLabel('Fruit legend').uncheck();
  await expect(page.locator('[data-kind="legend"]')).toHaveCount(0);
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `npx vitest run src/export && npx playwright test e2e/print.spec.ts`
Expected: FAIL — module missing; stub page.

- [ ] **Step 4: Implement `src/export/pdf/exportPdf.ts`**

```ts
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
  const doc = new jsPDF({ unit: 'mm', format: [first.width, first.height], orientation: 'portrait' });
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
```

- [ ] **Step 5: Implement `src/app/pages/PrintPage.tsx`**

```tsx
import { useState } from 'react';
import { DEFAULT_RENDER_OPTIONS, layoutSong, STAFF_SIZES, type NoteLabels, type Paper, type RenderOptions } from '../../core/layout';
import { downloadPdf } from '../../export/pdf/exportPdf';
import { SongPages } from '../components/SongPages';
import { routeToHash } from '../router';
import { messageOf, useSongLibrary } from '../useSongLibrary';

export function PrintPage({ songId }: { songId: string }) {
  const library = useSongLibrary();
  const [options, setOptions] = useState<RenderOptions>(DEFAULT_RENDER_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entry = library.find(songId);

  if (library.status === 'loading') return <p>Loading…</p>;
  if (!entry) {
    return (
      <section className="panel">
        <h1>Song not found</h1>
        <p><a href="#/">Back to the songbook</a></p>
      </section>
    );
  }
  const song = entry.song;

  const set = <K extends keyof RenderOptions>(key: K, value: RenderOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadPdf(layoutSong(song, options), song.title);
    } catch (e) {
      setError(`Couldn't make the PDF: ${messageOf(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="print">
      <div className="panel print-options no-print">
        <h1>{song.title}</h1>
        <div className="toolbar">
          <label>
            Paper{' '}
            <select value={options.paper} onChange={(e) => set('paper', e.target.value as Paper)}>
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <label>
            Staff size{' '}
            <select value={String(options.staffSpaceMm)} onChange={(e) => set('staffSpaceMm', Number(e.target.value))}>
              <option value={String(STAFF_SIZES.large)}>Large</option>
              <option value={String(STAFF_SIZES.jumbo)}>Jumbo</option>
            </select>
          </label>
          <label>
            Labels{' '}
            <select value={options.noteLabels} onChange={(e) => set('noteLabels', e.target.value as NoteLabels)}>
              <option value="letter">Letters (C D E)</option>
              <option value="solfege">Solfège (Do Re Mi)</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <div className="toolbar">
          <label><input type="checkbox" checked={options.showLegend} onChange={(e) => set('showLegend', e.target.checked)} /> Fruit legend</label>
          <label><input type="checkbox" checked={options.showTrebleClef} onChange={(e) => set('showTrebleClef', e.target.checked)} /> Treble clef</label>
          <label><input type="checkbox" checked={options.showMeasureNumbers} onChange={(e) => set('showMeasureNumbers', e.target.checked)} /> Measure numbers</label>
          <label><input type="checkbox" checked={options.sizeByDuration} onChange={(e) => set('sizeByDuration', e.target.checked)} /> Bigger fruit for longer notes (experimental)</label>
        </div>
        <div className="toolbar">
          <button type="button" disabled={busy} onClick={() => void exportPdf()}>
            {busy ? 'Making PDF…' : 'Download PDF'}
          </button>
          <button type="button" className="secondary" onClick={() => window.print()}>Print</button>
          <a className="button secondary" href={routeToHash({ name: 'edit', id: song.id })}>
            {entry.builtin ? 'Edit a copy' : 'Edit'}
          </a>
        </div>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => void exportPdf()}>Try again</button>
        </div>
      )}
      <SongPages song={song} options={options} />
    </div>
  );
}
```

> Note: all hooks are called before the early returns, so hook order is stable.

Append to `src/app/styles.css`:

```css
.print-options { margin-bottom: 20px; }
.print-options h1 { margin-top: 0; }
.print-options label { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
```

- [ ] **Step 6: Run to verify both pass**

Run: `npx vitest run src/export && npx playwright test e2e/print.spec.ts`
Expected: PASS. If the `/Subtype /Image` assertion fails, something rasterized — check that no `<image>` or `<foreignObject>` is in `PageSvg` output.

- [ ] **Step 7: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`

```bash
git add src e2e && git commit -m "feat(print): live print preview and vector PDF export"
```

---

### Task 27: APE concept-art script (dev-only)

**Files:**
- Create: `scripts/ape/apeClient.ts`, `scripts/ape/apeClient.test.ts`, `scripts/ape/prompts.ts`, `scripts/ape/generate-concepts.ts`

**Interfaces:**
- Produces:
  - `APE_IMAGES_URL = 'https://api.wearables-ape.io/models/v1/images'`
  - `interface GenerateImageRequest { apiKey: string; model: string; prompt: string; size?: '1024x1024' | '1024x1536' | '1536x1024'; quality?: 'low' | 'medium' | 'high'; background?: 'transparent' | 'opaque' }`
  - `class ApeError extends Error { readonly status: number; readonly retryAfterMs?: number }`
  - `APE_TIMEOUT_MS = 65_000`, `RETRYABLE_STATUSES: ReadonlySet<number>` = {408, 429, 500, 502, 503, 504}
  - `isRetryable(error: unknown): boolean` — `ApeError` with a retryable status, or an error named `TimeoutError` / `AbortError` / `TypeError` (network failure); never 400/401/403/422
  - `withRetry<T>(fn: () => Promise<T>, options?: { attempts?: number; baseDelayMs?: number }): Promise<T>` — default 3 attempts, backoff 2 s then 4 s; a 429's `Retry-After` (seconds) replaces the backoff
  - `generateImage(req: GenerateImageRequest, fetchImpl?: typeof fetch): Promise<Uint8Array>` — POST with Bearer auth and `AbortSignal.timeout(APE_TIMEOUT_MS)`; returns PNG bytes from `data[0].b64_json` (or downloads `data[0].url`, also with the timeout); the POST and the download are each wrapped in `withRetry`; `gpt-image*` models get `quality`, `background`, `output_format: 'png'`; error messages never contain the key
  - `CONCEPT_PROMPTS: { name: string; prompt: string; size: GenerateImageRequest['size'] }[]`
  - CLI: `npm run ape:concepts -- [--model gpt-image-1.5] [--quality low] [--only monster] [--out art-concepts]` — default quality is `low` (fast enough for APE's 60 s limit). Use `--quality medium|high` only together with `--only <name>` once a direction is chosen. Renders that need more than 60 s would need APE's async `/automation` endpoint, which is out of scope.

API facts (from `ape-docs.json`, verified 2026-10-13): `POST /models/v1/images` accepts `{ model, prompt, size, quality, background, output_format, n }`; response `{ data: [{ b64_json | url }] }`; available models include `gpt-image-1.5`, `gpt-image-2`, `nano-banana-pro`, `gemini-3.1-flash-image`; APE has a 60 s hard timeout and 60 req/min/model.

**Security:** the key is read from `.env` via `process.loadEnvFile`, sent only in the `Authorization` header, never logged, never written to `art-concepts/`. Nothing in `src/` may import `scripts/` (enforced by ESLint from Task 1).

- [ ] **Step 1: Write the failing test**

`scripts/ape/apeClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APE_IMAGES_URL, ApeError, generateImage, isRetryable, type GenerateImageRequest } from './apeClient';

const PNG_BYTES = Uint8Array.from([137, 80, 78, 71]);
const b64 = Buffer.from(PNG_BYTES).toString('base64');
const okResponse = () => new Response(JSON.stringify({ created: 1, data: [{ b64_json: b64 }] }), { status: 200 });
const REQ: GenerateImageRequest = { apiKey: 'secret-key', model: 'gpt-image-1.5', prompt: 'p' };
const asFetch = (f: unknown) => f as typeof fetch;

afterEach(() => {
  vi.useRealTimers();
});

describe('generateImage', () => {
  it('posts the prompt with bearer auth and a timeout, and decodes base64 PNG data', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const bytes = await generateImage(
      { apiKey: 'secret-key', model: 'gpt-image-1.5', prompt: 'a monster', size: '1536x1024', quality: 'high' },
      asFetch(fetchImpl),
    );
    expect(bytes).toEqual(PNG_BYTES);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(APE_IMAGES_URL);
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'gpt-image-1.5', prompt: 'a monster', n: 1, size: '1536x1024',
      quality: 'high', background: 'transparent', output_format: 'png',
    });
  });

  it('omits gpt-image-only options for other models', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    await generateImage({ apiKey: 'k', model: 'nano-banana-pro', prompt: 'p' }, asFetch(fetchImpl));
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ model: 'nano-banana-pro', prompt: 'p', n: 1, size: '1024x1024' });
  });

  it('downloads the image when APE returns a URL, with a timeout', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify({ data: [{ url: 'https://cdn.example/x.png' }] })))
      .mockImplementationOnce(async () => new Response(PNG_BYTES));
    expect(await generateImage(REQ, asFetch(fetchImpl))).toEqual(PNG_BYTES);
    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('https://cdn.example/x.png');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws ApeError with status and body, without retrying or leaking the key', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"detail":"bad prompt for secret-key"}', { status: 400 }));
    const error = await generateImage(REQ, asFetch(fetchImpl)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApeError);
    expect((error as ApeError).status).toBe(400);
    expect((error as ApeError).message).toContain('bad prompt');
    expect((error as ApeError).message).not.toContain('secret-key');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws when the response has no image', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ created: 1, data: [] })));
    await expect(generateImage(REQ, asFetch(fetchImpl))).rejects.toThrow('APE returned no image.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('retries', () => {
  it('retries a 504 after 2 s and succeeds on the second call', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => new Response('gateway timeout', { status: 504 }))
      .mockImplementationOnce(async () => okResponse());
    const result = generateImage(REQ, asFetch(fetchImpl));
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual(PNG_BYTES);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a timeout (TimeoutError)', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      })
      .mockImplementationOnce(async () => okResponse());
    const result = generateImage(REQ, asFetch(fetchImpl));
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual(PNG_BYTES);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('honours Retry-After on a 429', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => new Response('slow down', { status: 429, headers: { 'Retry-After': '5' } }))
      .mockImplementationOnce(async () => okResponse());
    const result = generateImage(REQ, asFetch(fetchImpl));
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual(PNG_BYTES);
  });

  it('gives up after 3 attempts with 2 s then 4 s backoff', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => new Response('unavailable', { status: 503 }));
    const result = generateImage(REQ, asFetch(fetchImpl)).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    const error = await result;
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect((error as ApeError).status).toBe(503);
    expect((error as ApeError).message).not.toContain('secret-key');
  });

  it('never retries client errors', async () => {
    for (const status of [400, 401, 403, 422]) {
      const fetchImpl = vi.fn(async () => new Response('no', { status }));
      await expect(generateImage(REQ, asFetch(fetchImpl))).rejects.toBeInstanceOf(ApeError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it('classifies errors', () => {
    expect(isRetryable(new ApeError('x', 502))).toBe(true);
    expect(isRetryable(new ApeError('x', 401))).toBe(false);
    expect(isRetryable(new TypeError('fetch failed'))).toBe(true);
    expect(isRetryable(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isRetryable(new Error('boom'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/ape`
Expected: FAIL — cannot resolve `./apeClient`.

- [ ] **Step 3: Implement**

`scripts/ape/apeClient.ts`:

```ts
export const APE_IMAGES_URL = 'https://api.wearables-ape.io/models/v1/images';
/** APE cuts requests off at 60 s; give it a little slack before we abort. */
export const APE_TIMEOUT_MS = 65_000;
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_NAMES = new Set(['TimeoutError', 'AbortError', 'TypeError']);

export interface GenerateImageRequest {
  apiKey: string;
  model: string;
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'low' | 'medium' | 'high';
  background?: 'transparent' | 'opaque';
}

export class ApeError extends Error {
  override name = 'ApeError';
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

interface ImagesResponse {
  data?: { b64_json?: string; url?: string }[] | null;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ApeError) return RETRYABLE_STATUSES.has(error.status);
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === 'string' && RETRYABLE_ERROR_NAMES.has(name);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 2000 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= attempts || !isRetryable(e)) throw e;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      await sleep(e instanceof ApeError && e.retryAfterMs !== undefined ? e.retryAfterMs : backoff);
    }
  }
}

function retryAfterMs(res: Response): number | undefined {
  if (res.status !== 429) return undefined;
  const seconds = Number(res.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : undefined;
}

export async function generateImage(req: GenerateImageRequest, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const body: Record<string, unknown> = { model: req.model, prompt: req.prompt, n: 1, size: req.size ?? '1024x1024' };
  if (req.model.startsWith('gpt-image')) {
    body.quality = req.quality ?? 'low';
    body.background = req.background ?? 'transparent';
    body.output_format = 'png';
  }
  const redact = (text: string) => text.split(req.apiKey).join('[redacted]');

  const json = await withRetry(async () => {
    const res = await fetchImpl(APE_IMAGES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${req.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(APE_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = redact((await res.text()).slice(0, 300));
      throw new ApeError(`APE image request failed (${res.status}): ${text}`, res.status, retryAfterMs(res));
    }
    return (await res.json()) as ImagesResponse;
  });

  const first = json.data?.[0];
  if (first?.b64_json) return Uint8Array.from(Buffer.from(first.b64_json, 'base64'));
  const imageUrl = first?.url;
  if (imageUrl) {
    return withRetry(async () => {
      const image = await fetchImpl(imageUrl, { signal: AbortSignal.timeout(APE_TIMEOUT_MS) });
      if (!image.ok) {
        throw new ApeError(`Downloading the generated image failed (${image.status}).`, image.status, retryAfterMs(image));
      }
      return new Uint8Array(await image.arrayBuffer());
    });
  }
  throw new ApeError('APE returned no image.', 200);
}
```

`scripts/ape/prompts.ts`:

```ts
import type { GenerateImageRequest } from './apeClient';

export interface ConceptPrompt {
  name: string;
  prompt: string;
  size: NonNullable<GenerateImageRequest['size']>;
}

const STYLE =
  "Flat vector sticker illustration for a children's music-learning worksheet. Thick rounded dark outlines, " +
  'bold simple shapes, minimal shading, friendly and cute, prints well on paper, centered on a plain ' +
  'transparent background.';
const NO_TEXT = 'No text, no letters, no numbers.';
const FRUITS =
  'a red apple, an orange, a yellow lemon, a green pear, a turquoise-blue blueberry, a bunch of purple grapes, and a pink raspberry';

export const CONCEPT_PROMPTS: ConceptPrompt[] = [
  {
    name: 'monster-round-chomper',
    prompt: `A round, friendly indigo-blue monster shaped like Pac-Man, seen from the side, with a wide open mouth facing to the RIGHT, ready to eat fruit. One big eye, two small cream horns, tiny feet, a few little white teeth, a pink tongue. ${STYLE} ${NO_TEXT}`,
    size: '1024x1024',
  },
  {
    name: 'monster-fuzzy-chomper',
    prompt: `A fuzzy, round, friendly indigo monster with a huge open mouth facing to the RIGHT like Pac-Man, eager to eat fruit, big happy eyes, small horns, stubby arms. ${STYLE} ${NO_TEXT}`,
    size: '1024x1024',
  },
  {
    name: 'monster-clef-chomper',
    prompt: `A cute monster whose curly body loosely echoes the shape of a treble clef (G clef) music symbol, with a big open mouth facing to the RIGHT ready to eat fruit, one big eye. ${STYLE} ${NO_TEXT}`,
    size: '1024x1536',
  },
  {
    name: 'fruit-lineup-solid',
    prompt: `Seven fruits in one horizontal row, evenly spaced, all the same size and roughly round so each fits in a circle: ${FRUITS}. ${STYLE} ${NO_TEXT}`,
    size: '1536x1024',
  },
  {
    name: 'fruit-lineup-outline',
    prompt: `Seven fruits in one horizontal row drawn as thick colored OUTLINES with a very pale tinted fill, like coloring-book shapes, all the same size: ${FRUITS}. ${STYLE} ${NO_TEXT}`,
    size: '1536x1024',
  },
  {
    name: 'worksheet-mockup',
    prompt: `A children's sheet-music worksheet: one large five-line music staff across the page. At the left end, a round friendly monster with its mouth open toward the right. Along the staff, colorful fruit sit on the lines and spaces like music notes: ${FRUITS}. ${STYLE}`,
    size: '1536x1024',
  },
];
```

`scripts/ape/generate-concepts.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { generateImage, type GenerateImageRequest } from './apeClient';
import { CONCEPT_PROMPTS } from './prompts';

function loadApiKey(): string {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env is optional if APE_KEY is already in the environment.
  }
  const key = process.env.APE_KEY;
  if (!key) {
    console.error('APE_KEY is not set. Add it to .env (see .env.example).');
    process.exit(1);
  }
  return key;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: 'string', default: 'gpt-image-1.5' },
      quality: { type: 'string', default: 'low' },
      only: { type: 'string' },
      out: { type: 'string', default: 'art-concepts' },
    },
  });
  const apiKey = loadApiKey();
  const model = values.model ?? 'gpt-image-1.5';
  const quality = (values.quality ?? 'low') as NonNullable<GenerateImageRequest['quality']>;
  const prompts = values.only ? CONCEPT_PROMPTS.filter((p) => p.name.includes(values.only ?? '')) : CONCEPT_PROMPTS;
  if (prompts.length === 0) {
    console.error(`No prompts match "${values.only}". Names: ${CONCEPT_PROMPTS.map((p) => p.name).join(', ')}`);
    process.exit(1);
  }

  const dir = path.resolve(values.out ?? 'art-concepts', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(dir, { recursive: true });

  let failures = 0;
  for (const p of prompts) {
    process.stdout.write(`→ ${p.name} (${model}) … `);
    try {
      const png = await generateImage({ apiKey, model, prompt: p.prompt, size: p.size, quality });
      const file = path.join(dir, `${p.name}.png`);
      await writeFile(file, png);
      console.log(`saved ${path.relative(process.cwd(), file)}`);
    } catch (e) {
      failures++;
      console.log(`failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await writeFile(path.join(dir, 'prompts.json'), `${JSON.stringify({ model, quality, prompts }, null, 2)}\n`);
  if (failures > 0) process.exitCode = 1;
}

void main();
```

- [ ] **Step 4: Run to verify the unit tests pass**

Run: `npx vitest run scripts/ape`
Expected: PASS.

- [ ] **Step 5: Smoke-run against APE (uses real credits; one image)**

Run: `npm run ape:concepts -- --only monster-round --quality low`
Expected: `→ monster-round-chomper (gpt-image-1.5) … saved art-concepts/<timestamp>/monster-round-chomper.png`. Open the PNG to confirm it's a real image. Transient failures (408/429/5xx, timeouts, network errors) are retried automatically (3 attempts, 2 s/4 s backoff). If it still times out, try `--model nano-banana-pro`; anything needing more than APE's 60 s limit would need the async `/automation` endpoint (out of scope).

Run: `git status --short`
Expected: nothing under `art-concepts/` and no `.env` listed.

- [ ] **Step 6: Full check & commit**

Run: `npm run lint && npm run typecheck && npm test`

```bash
git add scripts && git commit -m "chore(ape): dev-only concept art generator using APE image models"
```

---

### Task 28: Visual review, art-direction checkpoint, README

This task has a **human checkpoint**: the user picks an art direction before final art tweaks.

**Files:**
- Create: `README.md`
- Modify (only if the review calls for it): `src/render/art/fruits.tsx`, `src/render/art/Monster.tsx`, `src/core/layout/metrics.ts`

- [ ] **Step 1: Render every starter song in the shared debug Chrome**

```bash
curl -fsS --max-time 2 http://127.0.0.1:9222/json/version   # if this fails, ask the user to run: ! gcdb
npm run dev -- --port 5179 --strictPort                      # run in background
```

With the Playwright MCP tools, open a **new tab** (never close tab 0 or others' tabs) at `http://localhost:5179/#/print/<id>` for each of: `builtin-hot-cross-buns`, `builtin-old-macdonald` (low ledger lines), `builtin-ode-to-joy` (dotted + eighths), `builtin-jingle-bells` (beams, multi-page), and screenshot each. Also open one song with Jumbo + solfège + treble clef + measure numbers + size-by-duration all on.

Checklist (fix anything that fails, then re-run `npm test` — layout digests must only change if you intentionally changed metrics, in which case update snapshots with `npx vitest run -u src/songs` and review the diff):

- Every fruit is centered on its line or space; no leaf/stem crosses the next line.
- Ledger "twigs" for G3–C4 and A5–C6 sit exactly on line positions.
- Yellow lemons and their labels are legible on white.
- Hollow (half/whole) fruit are clearly distinguishable from solid ones.
- The monster faces the melody and doesn't collide with the first note.
- Labels below the staff never touch the G3 fruit.
- Eighth beams are horizontal and connect both stems; lone eighths have flags.
- The final bar line is thin + thick; the legend shows 7 fruit with letters/solfège.
- Treble clef (when on) sits between the monster and the first measure.

- [ ] **Step 2: Check the PDFs**

Download PDFs for Hot Cross Buns (Letter) and Twinkle (A4, Jumbo). Open them in Preview: zoom to 400 % (edges stay crisp = vector), check page breaks match the preview, check titles/labels render in Helvetica, and print one page in grayscale to confirm fruit silhouettes stay distinguishable.

- [ ] **Step 3: Generate concept art**

Run: `npm run ape:concepts -- --quality low`
Expected: six PNGs under `art-concepts/<timestamp>/`. (Low quality keeps each render inside APE's 60 s limit. Once the user picks a direction, re-render just that concept at higher quality: `npm run ape:concepts -- --only <name> --quality medium`.)

- [ ] **Step 4: Art-direction checkpoint (ask the user)**

Show the user the concept PNGs next to a screenshot of the current SVG print preview. Stop and ask the user (AskUserQuestion if available; otherwise end the task and report the three options with screenshot paths). Do not continue to Step 5 without an answer. The options:

1. **Keep the current SVG art** (no change)
2. **Refine the SVG toward concept X** — the user names which concept and what to borrow (e.g. fuzzier monster, chunkier outlines)
3. **Use an APE monster render** in place of the SVG monster (fruit stay SVG)

- [ ] **Step 5: Apply the chosen direction**

- Option 1: skip.
- Option 2: edit `Monster.tsx` / `fruits.tsx` shapes only (keep the unit-box contract and `data-kind` attributes), re-run `npx vitest run src/render`, re-screenshot, and confirm with the user.
- Option 3: copy the chosen PNG (transparent background, ≥1024 px) to `src/render/art/assets/monster.png` and replace the body of `Monster` with:

```tsx
import monsterPng from './assets/monster.png';

export function Monster({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <g data-kind="monster">
      <image href={monsterPng} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}
```

  Then update `glyphs.test.tsx` (the Monster tests assert the old path/transform — replace them with a check for `data-kind="monster"` and an `<image`), and **remove** the `/Subtype /Image` assertion from `e2e/print.spec.ts` (the monster is now a raster image by design). Confirm the PDF still looks sharp at print size.

- [ ] **Step 6: README**

`README.md`:

````markdown
# Note Chomp 🍎👾

Kid-friendly, color-coded sheet music you can print. Every note is a fruit (Chroma-Notes / Prodigies colors),
and a hungry monster at the start of each staff eats the melody as kids play it.

| C | D | E | F | G | A | B |
|---|---|---|---|---|---|---|
| 🍎 apple (red) | 🍊 orange | 🍋 lemon (yellow) | 🍐 pear (green) | 🫐 blueberry (turquoise) | 🍇 grapes (purple) | raspberry (pink) |

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run test:e2e     # browser tests
npm run build        # static site in dist/ (works on any static host)
```

## Add a starter melody

Drop an ABC file into `src/songs/` (key of C, 2/4–4/4, notes G3–C6), e.g. `src/songs/my-song.abc`:

```
X:1
T:My Song
M:4/4
L:1/4
K:C
C D E F | G2 G2 |]
```

`npm test` checks that every bundled song imports cleanly and records a layout snapshot.

## Architecture

- `src/core/` — pure TypeScript: song model + validation, music theory, palette, the layout engine
  (`layoutSong(song, options) → pages of positioned items, in mm`), and the editor reducer.
- `src/formats/` — ABC, MusicXML/.mxl and Note Chomp JSON importers (`importSong`).
- `src/render/` — one SVG renderer (fruit, monster, glyphs) used for both screen and PDF.
- `src/export/pdf/` — vector PDF via jsPDF + svg2pdf.js.
- `src/persistence/` — `SongRepository` interface + validated localStorage implementation.
- `src/app/` — React UI: songbook, tap editor, import, print preview.

Layer rules are enforced by ESLint (`core` imports nothing else; `formats` imports only `core`).

## Concept art with APE (optional, dev only)

Put your key in `.env` (`APE_KEY=...`, see `.env.example`; `.env` is gitignored), then:

```bash
npm run ape:concepts -- --model gpt-image-1.5            # quality defaults to low
npm run ape:concepts -- --only monster-round --quality medium   # once a direction is chosen
```

Images land in `art-concepts/` (gitignored). Requests time out after 65 s and transient failures are retried. The key is never bundled into the web app.
````

- [ ] **Step 7: Final verification & commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`
Expected: all green.

Run: `git status --short`
Expected: no `.env`, `ape.key`, or `art-concepts/` entries.

```bash
git add README.md src e2e && git commit -m "docs: README; art review pass"
```
