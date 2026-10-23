import { genresFor, MOODS, SURPRISE, TIMES } from './moods';
import type { Filters, MediaType, ReleasePreset } from './types';

export interface QueryContext {
  region: string;
  services: number[];
  showAll: boolean;
  today?: Date;
  random?: () => number;
}

export interface PullQuery {
  type: MediaType;
  /** Sorted query string without page, so identical filters share one cache entry. */
  key: string;
  params: Record<string, string>;
  surprise: boolean;
  cinemas: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export function releaseRange(preset: ReleasePreset, today: Date): { from: string; to: string } {
  const y = today.getUTCFullYear();
  const now = iso(today);
  switch (preset) {
    case 'cinemas':
      return { from: iso(addDays(today, -45)), to: iso(addDays(today, 7)) };
    case 'this-year':
      return { from: `${y}-01-01`, to: now };
    case 'last-5':
      return { from: `${y - 5}${now.slice(4)}`, to: now };
    case '2010s':
      return { from: '2010-01-01', to: '2019-12-31' };
    case '2000s':
      return { from: '2000-01-01', to: '2009-12-31' };
    case '90s':
      return { from: '1990-01-01', to: '1999-12-31' };
    case 'classics':
      return { from: '1900-01-01', to: '1979-12-31' };
  }
}

/** Turns the booth's filters into one /api/pull query. Random choices (movie or series, which preset) use `random`. */
export function buildQuery(f: Filters, ctx: QueryContext): PullQuery {
  const random = ctx.random ?? Math.random;
  const today = ctx.today ?? new Date();
  const surprise = f.mood === 'surprise';

  // A random pick among the chosen release presets, unless a custom range is set.
  const preset = f.years
    ? null
    : f.release.length
      ? f.release[Math.floor(random() * f.release.length)]
      : null;
  const cinemas = preset === 'cinemas';
  const type: MediaType = cinemas
    ? 'movie'
    : f.type === 'both'
      ? random() < 0.5
        ? 'movie'
        : 'tv'
      : f.type;

  const p: Record<string, string> = { type };
  const mood = MOODS.find((m) => m.id === f.mood);
  const userGenres = genresFor(type, f.genres);
  const blocked = genresFor(type, f.blocked);

  if (!surprise) {
    if (userGenres.length) p['genres'] = userGenres.join(f.match === 'all' ? ',' : '|');
    else if (mood?.[type].with) p['genres'] = mood[type].with!;
  }
  const without = new Set<string>([
    ...(surprise ? [] : (mood?.[type].without?.split(',') ?? [])),
    ...blocked.map(String),
  ]);
  // Never exclude a genre the person explicitly asked for.
  for (const g of userGenres) without.delete(String(g));
  if (without.size) p['without'] = [...without].join(',');

  const time = TIMES.find((t) => t.id === f.time);
  const max = type === 'movie' ? time?.movieMax : time?.tvMax;
  if (max) {
    p['runtimeMax'] = String(max);
    p['runtimeMin'] = type === 'movie' ? '40' : '10';
  }

  if (f.years) {
    p['from'] = `${f.years.from}-01-01`;
    p['to'] = f.years.to >= today.getUTCFullYear() ? iso(today) : `${f.years.to}-12-31`;
  } else if (preset) {
    const r = releaseRange(preset, today);
    p['from'] = r.from;
    p['to'] = r.to;
    if (cinemas) {
      p['releaseTypes'] = '3|2';
      p['region'] = ctx.region;
    }
  } else {
    p['to'] = iso(today);
  }

  const floor = surprise ? Math.max(SURPRISE.minRating, f.minRating) : f.minRating;
  if (floor > 0) p['minRating'] = String(floor);
  if (surprise) {
    p['minVotes'] = String(SURPRISE[type].minVotes);
    p['maxVotes'] = String(SURPRISE[type].maxVotes);
  } else {
    p['minVotes'] = cinemas ? '0' : type === 'movie' ? '100' : '50';
  }

  if (!cinemas && !ctx.showAll && ctx.services.length) {
    p['providers'] = ctx.services.join('|');
    p['region'] = ctx.region;
  } else if (!cinemas && f.streamOnly) {
    // Any subscription, free or ad-supported service in the viewer's country.
    p['streaming'] = '1';
    p['region'] = ctx.region;
  }

  const key = Object.keys(p)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(p[k])}`)
    .join('&');
  return { type, key, params: p, surprise, cinemas };
}
