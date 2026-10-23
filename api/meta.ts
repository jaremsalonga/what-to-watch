import { CACHE_WEEK, fail, json, methodNotAllowed, safe } from './_lib/http.js';
import { guard } from './_lib/guard.js';
import { tmdb, tmdbConfigured } from './_lib/tmdb.js';
import { BadRequest, mediaType, region } from './_lib/validate.js';

interface GenreList {
  genres: { id: number; name: string }[];
}
interface ProviderList {
  results: {
    provider_id: number;
    provider_name: string;
    logo_path: string | null;
    display_priorities?: Record<string, number>;
  }[];
}
interface RegionList {
  results: { iso_3166_1: string; english_name: string }[];
}

/**
 * GET /api/meta?kind=genres&type=movie
 * GET /api/meta?kind=providers&type=movie&region=PH
 * GET /api/meta?kind=regions
 * Lists that rarely change, cached for a week.
 */
export const GET = safe(async (req: Request): Promise<Response> => {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const q = new URL(req.url).searchParams;
  if (!tmdbConfigured()) return fail(503, 'Movie data is not configured yet.');
  try {
    const kind = q.get('kind');
    if (kind === 'genres') {
      const type = mediaType(q.get('type'));
      const data = await tmdb<GenreList>(`/genre/${type}/list`, { language: 'en' });
      return json({ genres: data.genres }, 200, { 'cache-control': CACHE_WEEK });
    }
    if (kind === 'providers') {
      const type = mediaType(q.get('type'));
      const r = region(q.get('region'));
      const data = await tmdb<ProviderList>(`/watch/providers/${type}`, {
        watch_region: r,
        language: 'en-US',
      });
      const providers = data.results
        .map((p) => ({
          id: p.provider_id,
          name: p.provider_name,
          logo: p.logo_path,
          priority: p.display_priorities?.[r] ?? 999,
        }))
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 60);
      return json({ region: r, providers }, 200, { 'cache-control': CACHE_WEEK });
    }
    if (kind === 'regions') {
      const data = await tmdb<RegionList>('/watch/providers/regions', { language: 'en-US' });
      const regions = data.results
        .map((r) => ({ code: r.iso_3166_1, name: r.english_name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return json({ regions }, 200, { 'cache-control': CACHE_WEEK });
    }
    return fail(400, 'kind must be genres, providers or regions');
  } catch (e) {
    if (e instanceof BadRequest) return fail(400, e.message);
    return fail(502, 'Movie data is unavailable right now.');
  }
});

export const POST = () => methodNotAllowed('GET');
