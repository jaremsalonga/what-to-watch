/** Calls TMDB with the server-side token. Never forwards a client-supplied path or URL. */

const BASE = 'https://api.themoviedb.org/3';

export class TmdbError extends Error {
  constructor(public status: number) {
    super(`TMDB responded ${status}`);
  }
}

export function tmdbConfigured(): boolean {
  return Boolean(process.env['TMDB_READ_TOKEN'] || process.env['TMDB_API_KEY']);
}

export async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: 'application/json' };
  const bearer = process.env['TMDB_READ_TOKEN'];
  if (bearer) headers['authorization'] = `Bearer ${bearer}`;
  else if (process.env['TMDB_API_KEY'])
    url.searchParams.set('api_key', process.env['TMDB_API_KEY']!);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new TmdbError(res.status);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof TmdbError) throw e;
    throw new TmdbError(504);
  } finally {
    clearTimeout(timer);
  }
}
