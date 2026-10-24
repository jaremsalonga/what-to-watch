import { Component, computed, inject, input, output, signal } from '@angular/core';
import { serviceSearch, showtimesUrl, trailerUrl } from '../core/links';
import { POSTER, type ProviderRef, type Title, type TitleDetails } from '../core/types';
import { uniqueProviders } from '../core/providers';
import { Dinner } from '../dinner/dinner';
import { DinnerCoupon } from '../dinner/dinner-coupon';

/** The printed ticket: poster, synopsis, where it streams, and what to do next. */
@Component({
  selector: 'app-ticket',
  imports: [DinnerCoupon],
  templateUrl: './ticket.html',
  styleUrl: './ticket.scss',
})
export class Ticket {
  /** The pick from the strip (always there) plus details once they load. */
  readonly title = input.required<Title>();
  protected readonly dinner = inject(Dinner);
  readonly details = input<TitleDetails | null>(null);
  readonly services = input<number[]>([]);
  readonly name = input<string | null>(null);
  readonly cinemas = input(false);
  readonly surprise = input(false);
  readonly isLater = input(false);
  readonly number = input(1);
  /** The loved film this pick leaned on. */
  readonly because = input<string | null>(null);
  /** Details failed to load: offer a retry and TMDB's page instead of "Checking…". */
  readonly detailsFailed = input(false);

  readonly again = output<void>();
  readonly skip = output<void>();
  readonly seen = output<void>();
  readonly later = output<void>();
  readonly share = output<void>();
  readonly retry = output<void>();

  protected readonly expanded = signal(false);
  /** Apps opened from a pill drop the search, so the title goes on the clipboard to paste. */
  protected readonly copied = signal(false);
  private copiedTimer?: ReturnType<typeof setTimeout>;
  protected readonly today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  protected readonly serial = computed(() => this.number().toString().padStart(4, '0'));
  /** Barcode bar widths, derived from the title id so each ticket prints its own. */
  protected readonly bars = computed(() => {
    let x = this.title().id * 2654435761;
    return Array.from({ length: 28 }, () => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return 1 + (x % 3);
    });
  });
  protected readonly posterFailed = signal(false);
  protected readonly poster = computed(() =>
    this.posterFailed() ? null : POSTER(this.details()?.poster ?? this.title().poster, 'w342'),
  );
  protected readonly overview = computed(
    () => this.details()?.overview || this.title().overview || 'No synopsis yet for this one.',
  );
  protected readonly year = computed(() => this.details()?.year ?? this.title().year);

  protected readonly meta = computed(() => {
    const d = this.details();
    const parts: string[] = [];
    if (this.year()) parts.push(String(this.year()));
    if (d?.runtime)
      parts.push(
        d.type === 'tv'
          ? `${d.runtime}m episodes`
          : `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`,
      );
    if (d?.seasons) parts.push(`${d.seasons} season${d.seasons > 1 ? 's' : ''}`);
    const rating = d?.rating ?? this.title().rating;
    if (rating) parts.push(`★ ${rating.toFixed(1)}`);
    return parts.join(' · ');
  });

  /** Streaming services for this title, the viewer's own first. */
  protected readonly stream = computed(() => {
    const mine = new Set(this.services());
    const list = uniqueProviders(this.details()?.watch.stream ?? []);
    return [...list].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
  });

  protected readonly rent = computed(() => uniqueProviders(this.details()?.watch.rent ?? []));

  /** The big button, only where the pills can't do the job: showtimes, or TMDB's page. */
  protected readonly primary = computed<{ label: string; href: string } | null>(() => {
    if (this.cinemas()) return { label: 'Find showtimes', href: showtimesUrl(this.title().title) };
    const d = this.details();
    if (d && !this.stream().length && d.watch.link)
      return { label: 'Where to watch', href: d.watch.link };
    return null;
  });

  /** Each "Stream it on" pill opens that service's search, or TMDB's where-to-watch page. */
  protected href(p: ProviderRef): string | null {
    return serviceSearch(p.id, this.title().title) ?? this.details()?.watch.link ?? null;
  }

  /** TMDB's "where to watch" page, built from the id when details never arrived. */
  protected readonly tmdbWatch = computed(
    () => `https://www.themoviedb.org/${this.title().type}/${this.title().id}/watch`,
  );

  protected readonly trailer = computed(() => {
    const key = this.details()?.trailer;
    return key ? trailerUrl(key) : null;
  });

  protected copyTitle() {
    navigator.clipboard
      ?.writeText(this.title().title)
      .then(() => {
        this.copied.set(true);
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => this.copied.set(false), 6000);
      })
      .catch(() => {});
  }

  protected readonly logo = (path: string | null) => POSTER(path, 'w92');
}
