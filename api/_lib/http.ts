/** Small helpers shared by every API route. */

export const CACHE_DAY = 'public, max-age=300, s-maxage=43200, stale-while-revalidate=86400';
export const CACHE_WEEK = 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800';
export const NO_STORE = 'no-store';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': NO_STORE,
      ...headers,
    },
  });
}

export function fail(status: number, message: string, headers: Record<string, string> = {}) {
  return json({ error: message }, status, headers);
}

/**
 * Wraps a route so an unexpected error is logged (visible in Vercel's function logs) and
 * answered with JSON, instead of the platform's bare 500 page.
 */
export function safe(handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (e) {
      console.error(`${req.method} ${new URL(req.url, 'http://local').pathname} failed:`, e);
      return fail(500, 'Something went wrong on our side. Try again in a moment.');
    }
  };
}

export function tooMany(resetMs: number) {
  const seconds = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
  return fail(429, 'Too many requests. Try again in a moment.', { 'retry-after': String(seconds) });
}

export function methodNotAllowed(allowed: string) {
  return fail(405, 'Method not allowed.', { allow: allowed });
}

/** The visitor's IP as Vercel reports it. Clients can't set x-real-ip on Vercel. */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return '0.0.0.0';
}

/**
 * True when the request comes from another site. Browsers send Sec-Fetch-Site on every
 * request and Origin on POSTs, so a page elsewhere can't use our API (or our TMDB key).
 */
export function isCrossSite(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site === 'cross-site') return true;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Reads a small JSON body, refusing anything large or not JSON. */
export async function readJson(
  req: Request,
  maxBytes = 1024,
): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
