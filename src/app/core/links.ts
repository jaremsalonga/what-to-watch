/** Search links on the big streaming services. Others fall back to TMDB's "where to watch" page. */
const SEARCH: Record<number, (q: string) => string> = {
  8: (q) => `https://www.netflix.com/search?q=${q}`,
  9: (q) => `https://www.primevideo.com/search/ref=atv_nb_sug?phrase=${q}`,
  119: (q) => `https://www.primevideo.com/search/ref=atv_nb_sug?phrase=${q}`,
  337: (q) => `https://www.disneyplus.com/search?q=${q}`,
  350: (q) => `https://tv.apple.com/search?term=${q}`,
  2: (q) => `https://tv.apple.com/search?term=${q}`,
  283: (q) => `https://www.crunchyroll.com/search?q=${q}`,
  1899: (q) => `https://play.max.com/search?q=${q}`,
  384: (q) => `https://play.max.com/search?q=${q}`,
  15: (q) => `https://www.hulu.com/search?q=${q}`,
  531: (q) => `https://www.paramountplus.com/search/?q=${q}`,
};

export function serviceSearch(providerId: number, title: string): string | null {
  const f = SEARCH[providerId];
  return f ? f(encodeURIComponent(title)) : null;
}

export const trailerUrl = (key: string) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`;
export const showtimesUrl = (title: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${title} showtimes near me`)}`;

/** Where "Contact us" goes. */
export const CONTACT_EMAIL = 'whattoeat.jsalonga@gmail.com';
export const contactUrl = (subject = 'What to Watch?') =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
