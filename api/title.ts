import { CACHE_DAY, fail, json, methodNotAllowed, safe } from './_lib/http.js';
import { guard } from './_lib/guard.js';
import { tmdb, tmdbConfigured } from './_lib/tmdb.js';
import { BadRequest, intIn, mediaType, region } from './_lib/validate.js';

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}
interface Details {
  id: number;
  title?: string;
  name?: string;
  tagline?: string;
  overview?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  genres?: { id: number; name: string }[];
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] };
  'watch/providers'?: {
    results: Record<
      string,
      {
        link?: string;
        flatrate?: Provider[];
        free?: Provider[];
        ads?: Provider[];
        rent?: Provider[];
        buy?: Provider[];
      }
    >;
  };
}

const slimProviders = (list: Provider[] = []) =>
  list.slice(0, 12).map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path }));

/** GET /api/title?type=movie&id=129&region=PH: runtime, trailer and where it streams. */
export const GET = safe(async (req: Request): Promise<Response> => {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const q = new URL(req.url).searchParams;
  try {
    const type = mediaType(q.get('type'));
    const id = intIn(q.get('id'), 1, 99_999_999, 'id');
    const r = region(q.get('region'));
    if (id == null || !Number.isInteger(id)) throw new BadRequest('id is required');
    if (!tmdbConfigured()) return fail(503, 'Movie data is not configured yet.');
    const d = await tmdb<Details>(`/${type}/${id}`, {
      language: 'en-US',
      append_to_response: 'videos,watch/providers',
    });
    const videos = (d.videos?.results ?? []).filter((v) => v.site === 'YouTube');
    const trailer =
      videos.find((v) => v.type === 'Trailer' && v.official) ??
      videos.find((v) => v.type === 'Trailer') ??
      videos[0];
    const where = d['watch/providers']?.results?.[r];
    const date = (type === 'movie' ? d.release_date : d.first_air_date) ?? '';
    return json(
      {
        id: d.id,
        type,
        title: d.title ?? d.name ?? '',
        tagline: d.tagline ?? '',
        overview: d.overview ?? '',
        runtime: type === 'movie' ? (d.runtime ?? null) : (d.episode_run_time?.[0] ?? null),
        seasons: d.number_of_seasons ?? null,
        genres: (d.genres ?? []).map((x) => x.name),
        year: date ? Number(date.slice(0, 4)) : null,
        poster: d.poster_path ?? null,
        backdrop: d.backdrop_path ?? null,
        rating: Math.round((d.vote_average ?? 0) * 10) / 10,
        trailer: trailer && /^[\w-]{6,20}$/.test(trailer.key) ? trailer.key : null,
        watch: {
          region: r,
          link: where?.link?.startsWith('https://www.themoviedb.org/') ? where.link : null,
          stream: slimProviders([
            ...(where?.flatrate ?? []),
            ...(where?.free ?? []),
            ...(where?.ads ?? []),
          ]),
          rent: slimProviders(where?.rent),
          buy: slimProviders(where?.buy),
        },
      },
      200,
      { 'cache-control': CACHE_DAY },
    );
  } catch (e) {
    if (e instanceof BadRequest) return fail(400, e.message);
    return fail(502, 'Movie data is unavailable right now.');
  }
});

export const POST = () => methodNotAllowed('GET');
