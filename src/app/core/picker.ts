import { inject, Injectable } from '@angular/core';
import { Api } from './api';
import { buildQuery, type PullQuery } from './query';
import { AppState } from './state';
import type { Title } from './types';

export interface PullResult {
  query: PullQuery;
  winner: Title;
  /** Posters for the film strip, ending with the winner. */
  reel: Title[];
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

  /** `surprise` rolls a hidden gem with the current filters, without changing the mood. */
  async pull(random = Math.random, surprise = false): Promise<PullResult> {
    const filters = this.state.filters();
    const query = buildQuery(surprise ? { ...filters, mood: 'surprise' } : filters, {
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
