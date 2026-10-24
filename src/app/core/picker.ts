import { inject, Injectable } from '@angular/core';
import { Api } from './api';
import { buildQuery, type PullQuery } from './query';
import { AppState } from './state';
import { MOVIE_GENRES } from './moods';
import type { Filters, Title } from './types';

const MOVIE_GENRE_IDS = new Set(MOVIE_GENRES.map((g) => g.id));

export interface PullResult {
  query: PullQuery;
  winner: Title;
  /** Posters for the film strip, ending with the winner. */
  reel: Title[];
  /** The loved film this roll leaned on, if any. */
  because?: string;
}

export class NothingFound extends Error {}

/** Picks a random title for the current filters, skipping films marked seen or skipped. */
@Injectable({ providedIn: 'root' })
export class Picker {
  private readonly api = inject(Api);
  private readonly state = inject(AppState);
  /** total_pages per query, so repeat pulls go straight to a random page. */
  private readonly pages = new Map<string, number>();
  /** "Not this one" for this visit. */
  readonly skipped = new Set<string>();

  /**
   * `surprise` rolls a hidden gem with the current filters, without changing the mood.
   * When no genre or mood is set, half the rolls lean on a film you loved: they ask for its
   * genres, and fall back to a normal roll if nothing matches.
   */
  async pull(random = Math.random, surprise = false): Promise<PullResult> {
    const filters = this.state.filters();
    const cinemasOnly = filters.release.length === 1 && filters.release[0] === 'cinemas';
    const loved = this.state
      .seen()
      .filter((s) => s.liked && s.genres?.some((g) => MOVIE_GENRE_IDS.has(g)));
    if (!surprise && !filters.mood && !filters.genres.length && !cinemasOnly && loved.length) {
      if (random() < 0.5) {
        const pick = loved[Math.floor(random() * loved.length)];
        const genres = pick.genres!.filter((g) => MOVIE_GENRE_IDS.has(g)).slice(0, 2);
        try {
          const res = await this.pullWith({ ...filters, genres, match: 'all' }, random);
          return { ...res, because: pick.title };
        } catch (e) {
          if (!(e instanceof NothingFound)) throw e;
        }
      }
    }
    return this.pullWith(surprise ? { ...filters, mood: 'surprise' } : filters, random);
  }

  private async pullWith(filters: Filters, random: () => number): Promise<PullResult> {
    const query = buildQuery(filters, {
      region: this.state.region(),
      services: this.state.services(),
      showAll: this.state.showAll(),
      random,
    });
    const cap = query.surprise ? 20 : 10;
    const known = this.pages.get(query.key);
    const tried = new Set<number>();

    for (let attempt = 0; attempt < 3; attempt++) {
      const total = known ?? this.pages.get(query.key);
      let page = total ? 1 + Math.floor(random() * Math.min(total, cap)) : 1;
      if (tried.has(page) && total) page = 1 + (page % Math.min(total, cap) || 0);
      tried.add(page);
      const res = await this.api.pull(query.key, page);
      this.pages.set(query.key, Math.max(1, res.totalPages));
      const fresh = res.results.filter(
        (t) => !this.state.isSeen(t.id, t.type) && !this.skipped.has(`${t.type}:${t.id}`),
      );
      if (fresh.length) {
        const winner = fresh[Math.floor(random() * fresh.length)];
        const others = shuffle(
          res.results.filter((t) => t !== winner && t.poster),
          random,
        );
        const reel = [
          ...Array.from({ length: 16 }, (_, i) => others[i % Math.max(1, others.length)]).filter(
            Boolean,
          ),
          winner,
        ];
        return { query, winner, reel };
      }
      if (res.totalResults === 0) break;
      if (attempt === 0 && !total && res.totalPages <= 1) break;
    }
    throw new NothingFound();
  }
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
