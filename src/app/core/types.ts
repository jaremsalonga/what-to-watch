export type MediaType = 'movie' | 'tv';
export type TypeChoice = MediaType | 'both';
export type Mood =
  | 'feel-good'
  | 'romantic'
  | 'tearjerker'
  | 'scary'
  | 'funny'
  | 'mind-bending'
  | 'action'
  | 'surprise';
export type TimeChoice = 'short' | 'medium' | 'any';
export type ReleasePreset =
  'cinemas' | 'this-year' | 'last-5' | '2010s' | '2000s' | '90s' | 'classics';

export interface Title {
  id: number;
  type: MediaType;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: number | null;
  rating: number;
  votes: number;
  genres: number[];
  lang: string;
}

export interface PullPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: Title[];
}

export interface ProviderRef {
  id: number;
  name: string;
  logo: string | null;
}

export interface TitleDetails {
  id: number;
  type: MediaType;
  title: string;
  tagline: string;
  overview: string;
  runtime: number | null;
  seasons: number | null;
  genres: string[];
  year: number | null;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  trailer: string | null;
  watch: {
    region: string;
    link: string | null;
    stream: ProviderRef[];
    rent: ProviderRef[];
    buy: ProviderRef[];
  };
}

export interface Genre {
  id: number;
  name: string;
}

export interface Provider extends ProviderRef {
  priority: number;
}

export interface Filters {
  mood: Mood | null;
  time: TimeChoice;
  type: TypeChoice;
  /** Movie genre ids; mapped to series genres when needed. */
  genres: number[];
  match: 'any' | 'all';
  blocked: number[];
  release: ReleasePreset[];
  /** Custom year range; overrides the presets when set. */
  years: { from: number; to: number } | null;
  minRating: number;
}

export const DEFAULT_FILTERS: Filters = {
  mood: null,
  time: 'any',
  type: 'movie',
  genres: [],
  match: 'any',
  blocked: [],
  release: [],
  years: null,
  minRating: 0,
};

export const POSTER = (path: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' = 'w185') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
