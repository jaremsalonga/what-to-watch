import type { MediaType, Mood, ReleasePreset, TimeChoice } from './types';

export interface MoodDef {
  id: Mood;
  label: string;
  /** TMDB with_genres / without_genres per media type ("|" = any of, "," = all of). */
  movie: { with?: string; without?: string };
  tv: { with?: string; without?: string };
}

export const MOODS: MoodDef[] = [
  {
    id: 'feel-good',
    label: 'Feel-good',
    movie: { with: '35|10751|16|10402', without: '27,10752,53' },
    tv: { with: '35|10751|16', without: '80,10768' },
  },
  {
    id: 'romantic',
    label: 'Romantic',
    movie: { with: '10749', without: '27' },
    tv: { with: '18', without: '80,10765,10759,16' },
  },
  {
    id: 'tearjerker',
    label: 'Tearjerker',
    movie: { with: '18', without: '35,27,16' },
    tv: { with: '18', without: '35,16' },
  },
  {
    id: 'scary',
    label: 'Scary',
    movie: { with: '27|53' },
    tv: { with: '9648|10765', without: '35,16,10751' },
  },
  { id: 'funny', label: 'Funny', movie: { with: '35', without: '27' }, tv: { with: '35' } },
  {
    id: 'mind-bending',
    label: 'Mind-bending',
    movie: { with: '878|9648' },
    tv: { with: '10765|9648' },
  },
  { id: 'action', label: 'Action', movie: { with: '28|12|10752|37' }, tv: { with: '10759|10768' } },
];

export const SURPRISE = {
  minRating: 7.3,
  movie: { minVotes: 150, maxVotes: 2000 },
  tv: { minVotes: 50, maxVotes: 1000 },
};

/** Movie genre id -> series genre id. Genres with no series match are dropped for series. */
export const MOVIE_TO_TV: Record<number, number> = {
  28: 10759,
  12: 10759,
  16: 16,
  35: 35,
  80: 80,
  99: 99,
  18: 18,
  10751: 10751,
  14: 10765,
  878: 10765,
  9648: 9648,
  10752: 10768,
  37: 37,
};

export function genresFor(type: MediaType, movieIds: number[]): number[] {
  if (type === 'movie') return movieIds;
  return [...new Set(movieIds.map((id) => MOVIE_TO_TV[id]).filter((x): x is number => x != null))];
}

export const TIMES: {
  id: TimeChoice;
  label: string;
  tvLabel: string;
  movieMax: number | null;
  tvMax: number | null;
}[] = [
  { id: 'short', label: 'Under 90 min', tvLabel: 'Short episodes', movieMax: 90, tvMax: 30 },
  { id: 'medium', label: 'Up to 2h', tvLabel: 'Up to 1h episodes', movieMax: 120, tvMax: 60 },
  { id: 'any', label: 'No limit', tvLabel: 'Any length', movieMax: null, tvMax: null },
];

export const RELEASES: { id: ReleasePreset; label: string }[] = [
  { id: 'cinemas', label: 'In cinemas now' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-5', label: 'Last 5 years' },
  { id: '2010s', label: '2010s' },
  { id: '2000s', label: '2000s' },
  { id: '90s', label: '90s' },
  { id: 'classics', label: 'Classics (before 1980)' },
];

/** TMDB's movie genres, used until the live list loads (and if it can't). */
export const MOVIE_GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' },
  { id: 10770, name: 'TV Movie' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];
