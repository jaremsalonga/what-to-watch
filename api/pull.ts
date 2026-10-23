import { CACHE_DAY, fail, json, methodNotAllowed } from './_lib/http';
import { guard } from './_lib/guard';
import { tmdb, tmdbConfigured, TmdbError } from './_lib/tmdb';
import { BadRequest, discoverParams, slimTitle, type RawTitle } from './_lib/validate';

interface DiscoverPage {
  page: number;
  total_pages: number;
  total_results: number;
  results: RawTitle[];
}

/** GET /api/pull: one page of discover results for the booth's filters. Cached at the edge. */
export async function GET(req: Request): Promise<Response> {
  const g = await guard(req);
  if (g instanceof Response) return g;
  let request;
  try {
    request = discoverParams(new URL(req.url).searchParams);
  } catch (e) {
    return fail(400, e instanceof BadRequest ? e.message : 'Bad request.');
  }
  if (!tmdbConfigured()) return fail(503, 'Movie data is not configured yet.');
  try {
    const page = await tmdb<DiscoverPage>(`/discover/${request.type}`, request.params);
    return json(
      {
        page: page.page,
        totalPages: Math.min(page.total_pages, 500),
        totalResults: page.total_results,
        results: page.results.map((t) => slimTitle(t, request.type)),
      },
      200,
      { 'cache-control': CACHE_DAY },
    );
  } catch (e) {
    return fail(
      e instanceof TmdbError && e.status === 429 ? 503 : 502,
      'Movie data is unavailable right now.',
    );
  }
}

export const POST = () => methodNotAllowed('GET');
