/**
 * Borde de red. Cuando NEXT_PUBLIC_USE_MOCKS=true (default en dev/CI), las
 * peticiones se resuelven desde fixtures locales y NO se hace fetch — así el
 * build, los tests y el desarrollo offline no dependen de la red.
 */
export const USE_MOCKS =
  (process.env.NEXT_PUBLIC_USE_MOCKS ?? 'true').toLowerCase() !== 'false';

export interface FetchOptions {
  timeoutMs?: number;
}

export async function getJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  return (await get(url, opts, (res) => res.json())) as T;
}

export async function getText(url: string, opts: FetchOptions = {}): Promise<string> {
  return get(url, opts, (res) => res.text());
}

async function get<T>(
  url: string,
  { timeoutMs = 12_000 }: FetchOptions,
  read: (res: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al pedir ${url}`);
    }
    return await read(res);
  } finally {
    clearTimeout(timer);
  }
}
