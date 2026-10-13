import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APE_IMAGES_URL,
  ApeError,
  generateImage,
  isRetryable,
  type GenerateImageRequest,
} from './apeClient';

const PNG_BYTES = Uint8Array.from([137, 80, 78, 71]);
const b64 = Buffer.from(PNG_BYTES).toString('base64');
const okResponse = () =>
  new Response(JSON.stringify({ created: 1, data: [{ b64_json: b64 }] }), { status: 200 });
const REQ: GenerateImageRequest = { apiKey: 'secret-key', model: 'gpt-image-1.5', prompt: 'p' };
const asFetch = (f: unknown) => f as typeof fetch;

afterEach(() => {
  vi.useRealTimers();
});

describe('generateImage', () => {
  it('posts the prompt with bearer auth and a timeout, and decodes base64 PNG data', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const bytes = await generateImage(
      {
        apiKey: 'secret-key',
        model: 'gpt-image-1.5',
        prompt: 'a monster',
        size: '1536x1024',
        quality: 'high',
      },
      asFetch(fetchImpl),
    );
    expect(bytes).toEqual(PNG_BYTES);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(APE_IMAGES_URL);
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'gpt-image-1.5',
      prompt: 'a monster',
      n: 1,
      size: '1536x1024',
      quality: 'high',
      background: 'transparent',
      output_format: 'png',
    });
  });

  it('omits gpt-image-only options for other models', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    await generateImage({ apiKey: 'k', model: 'nano-banana-pro', prompt: 'p' }, asFetch(fetchImpl));
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'nano-banana-pro',
      prompt: 'p',
      n: 1,
      size: '1024x1024',
    });
  });

  it('downloads the image when APE returns a URL, with a timeout', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(
        async () => new Response(JSON.stringify({ data: [{ url: 'https://cdn.example/x.png' }] })),
      )
      .mockImplementationOnce(async () => new Response(PNG_BYTES));
    expect(await generateImage(REQ, asFetch(fetchImpl))).toEqual(PNG_BYTES);
    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('https://cdn.example/x.png');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws ApeError with status and body, without retrying or leaking the key', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"detail":"bad prompt for secret-key"}', { status: 400 }),
    );
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
      .mockImplementationOnce(
        async () => new Response('slow down', { status: 429, headers: { 'Retry-After': '5' } }),
      )
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
