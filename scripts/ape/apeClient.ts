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

export async function generateImage(
  req: GenerateImageRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const body: Record<string, unknown> = {
    model: req.model,
    prompt: req.prompt,
    n: 1,
    size: req.size ?? '1024x1024',
  };
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
      throw new ApeError(
        `APE image request failed (${res.status}): ${text}`,
        res.status,
        retryAfterMs(res),
      );
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
        throw new ApeError(
          `Downloading the generated image failed (${image.status}).`,
          image.status,
          retryAfterMs(image),
        );
      }
      return new Uint8Array(await image.arrayBuffer());
    });
  }
  throw new ApeError('APE returned no image.', 200);
}
