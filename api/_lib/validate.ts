/**
 * Turns the app's query string into TMDB discover parameters. Everything is allowlisted:
 * unknown keys are dropped, numbers are clamped, and anything malformed is rejected.
 */

export type MediaType = 'movie' | 'tv';

export class BadRequest extends Error {}

const GENRES = /^\d{1,5}([,|]\d{1,5}){0,11}$/;
const PROVIDERS = /^\d{1,5}(\|\d{1,5}){0,24}$/;
const DATE = /^(19|20)\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const REGION = /^[A-Z]{2}$/;
const LANG = /^[a-z]{2}$/;
const RELEASE_TYPES = /^[1-6](\|[1-6]){0,5}$/;
const SORTS = new Set(['popularity.desc', 'vote_average.desc', 'vote_count.desc']);

export function mediaType(value: string | null): MediaType {
  if (value === 'movie' || value === 'tv') return value;
  throw new BadRequest('type must be movie or tv');
}

export function region(value: string | null, fallback = 'PH'): string {
  if (value == null || value === '') return fallback;
  if (!REGION.test(value)) throw new BadRequest('region must be a two-letter country code');
  return value;
}

export function intIn(value: string | null, min: number, max: number, name: string): number | null {
  if (value == null || value === '') return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) throw new BadRequest(`${name} must be a number`);
  const n = Number(value);
  return Math.min(max, Math.max(min, n));
}

function match(value: string | null, re: RegExp, name: string): string | null {
  if (value == null || value === '') return null;
  if (!re.test(value)) throw new BadRequest(`${name} is not valid`);
  return value;
}

export interface DiscoverRequest {
  type: MediaType;
  params: Record<string, string>;
}

export function discoverParams(q: URLSearchParams): DiscoverRequest {
  const type = mediaType(q.get('type'));
  const p: Record<string, string> = {
    include_adult: 'false',
    include_video: 'false',
    language: 'en-US',
    sort_by: 'popularity.desc',
    page: String(intIn(q.get('page'), 1, 20, 'page') ?? 1),
  };
  const sort = q.get('sort');
  if (sort) {
    if (!SORTS.has(sort)) throw new BadRequest('sort is not valid');
    p['sort_by'] = sort;
  }
  const genres = match(q.get('genres'), GENRES, 'genres');
  if (genres) p['with_genres'] = genres;
  const without = match(q.get('without'), GENRES, 'without');
  if (without) p['without_genres'] = without.replaceAll('|', ',');

  const rMin = intIn(q.get('runtimeMin'), 0, 400, 'runtimeMin');
  const rMax = intIn(q.get('runtimeMax'), 1, 400, 'runtimeMax');
  if (rMin != null) p['with_runtime.gte'] = String(rMin);
  if (rMax != null) p['with_runtime.lte'] = String(rMax);

  const from = match(q.get('from'), DATE, 'from');
  const to = match(q.get('to'), DATE, 'to');
  const dateKey = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const releaseTypes = match(q.get('releaseTypes'), RELEASE_TYPES, 'releaseTypes');
  if (releaseTypes && type === 'movie') {
    // "In cinemas now": theatrical releases in this region, by regional release date.
    p['with_release_type'] = releaseTypes;
    p['region'] = region(q.get('region'));
    if (from) p['release_date.gte'] = from;
    if (to) p['release_date.lte'] = to;
  } else {
    if (from) p[`${dateKey}.gte`] = from;
    if (to) p[`${dateKey}.lte`] = to;
  }

  const minRating = intIn(q.get('minRating'), 0, 10, 'minRating');
  if (minRating != null) p['vote_average.gte'] = String(minRating);
  const minVotes = intIn(q.get('minVotes'), 0, 100000, 'minVotes');
  if (minVotes != null) p['vote_count.gte'] = String(minVotes);
  const maxVotes = intIn(q.get('maxVotes'), 0, 1000000, 'maxVotes');
  if (maxVotes != null) p['vote_count.lte'] = String(maxVotes);

  const lang = match(q.get('lang'), LANG, 'lang');
  if (lang) p['with_original_language'] = lang;

  const providers = match(q.get('providers'), PROVIDERS, 'providers');
  if (providers) {
    p['with_watch_providers'] = providers;
    p['watch_region'] = region(q.get('region'));
    p['with_watch_monetization_types'] = 'flatrate|free|ads';
  } else if (q.get('streaming') === '1') {
    p['watch_region'] = region(q.get('region'));
    p['with_watch_monetization_types'] = 'flatrate|free|ads';
  }
  return { type, params: p };
}

/** Keeps a discover page small: only the fields the strip and ticket use. */
export interface RawTitle {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  original_language?: string;
}

export function slimTitle(t: RawTitle, type: MediaType) {
  const date = (type === 'movie' ? t.release_date : t.first_air_date) ?? '';
  return {
    id: t.id,
    type,
    title: (t.title ?? t.name ?? '').slice(0, 200),
    overview: (t.overview ?? '').slice(0, 1200),
    poster: t.poster_path ?? null,
    backdrop: t.backdrop_path ?? null,
    year: date ? Number(date.slice(0, 4)) : null,
    rating: Math.round((t.vote_average ?? 0) * 10) / 10,
    votes: t.vote_count ?? 0,
    genres: (t.genre_ids ?? []).slice(0, 8),
    lang: t.original_language ?? '',
  };
}
