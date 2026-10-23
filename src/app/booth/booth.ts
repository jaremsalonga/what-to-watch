import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError, BusyError, OfflineError, Api } from '../core/api';
import { MOODS, MOVIE_GENRES, RELEASES, TIMES } from '../core/moods';
import { NothingFound, Picker } from '../core/picker';
import { AppState } from '../core/state';
import type { Genre, Mood, ReleasePreset, TimeChoice, TypeChoice } from '../core/types';
import { FilmStrip } from '../film-strip/film-strip';
import { Ticket } from '../ticket/ticket';

type Panel = 'genres' | 'more' | null;

@Component({
  selector: 'app-booth',
  imports: [FilmStrip, Ticket, RouterLink],
  templateUrl: './booth.html',
  styleUrl: './booth.scss',
})
export class Booth implements OnInit, OnDestroy {
  protected readonly state = inject(AppState);
  private readonly api = inject(Api);
  private readonly picker = inject(Picker);
  private readonly strip = viewChild.required(FilmStrip);
  private readonly ticketEl = viewChild<ElementRef<HTMLElement>>('ticketAnchor');

  protected readonly moods = MOODS;
  protected readonly times = TIMES;
  protected readonly releases = RELEASES;
  protected readonly types: { id: TypeChoice; label: string }[] = [
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'Series' },
    { id: 'both', label: 'Both' },
  ];
  protected readonly genreList = signal<Genre[]>(MOVIE_GENRES);
  protected readonly panel = signal<Panel>(null);
  protected readonly genreMode = signal<'pick' | 'block'>('pick');
  protected readonly rolling = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly busyFor = signal(0);
  private busyTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly f = this.state.filters;
  protected readonly last = this.state.last;
  protected readonly years = Array.from(
    { length: new Date().getFullYear() - 1919 },
    (_, i) => new Date().getFullYear() - i,
  );

  protected readonly genreCount = computed(() => this.f().genres.length + this.f().blocked.length);
  protected readonly moreCount = computed(
    () => this.f().release.length + (this.f().years ? 1 : 0) + (this.f().minRating ? 1 : 0),
  );
  protected readonly cinemasOnly = computed(
    () => this.f().release.length === 1 && this.f().release[0] === 'cinemas',
  );
  protected readonly servicesLine = computed(() => {
    if (this.cinemasOnly()) return 'Showing films in cinemas near you';
    if (this.state.showAll() || !this.state.services().length)
      return `Everything on TMDB · ${this.state.region()}`;
    const n = this.state.services().length;
    return `From your ${n} service${n > 1 ? 's' : ''} in ${this.state.region()}`;
  });

  ngOnInit() {
    this.api
      .genres('movie')
      .then((r) => r.genres.length && this.genreList.set(r.genres))
      .catch(() => undefined);
  }

  ngOnDestroy() {
    if (this.busyTimer) clearInterval(this.busyTimer);
  }

  protected setMood(m: Mood) {
    this.state.patchFilters({ mood: this.f().mood === m ? null : m });
  }
  protected setTime(t: TimeChoice) {
    this.state.patchFilters({ time: t });
  }
  protected setType(t: TypeChoice) {
    this.state.patchFilters({ type: t });
  }
  protected toggle(p: Exclude<Panel, null>) {
    this.panel.set(this.panel() === p ? null : p);
  }

  protected genreState(id: number): 'on' | 'blocked' | 'off' {
    if (this.f().genres.includes(id)) return 'on';
    if (this.f().blocked.includes(id)) return 'blocked';
    return 'off';
  }
  protected tapGenre(id: number) {
    const { genres, blocked } = this.f();
    if (this.genreMode() === 'pick') {
      this.state.patchFilters({
        genres: genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id],
        blocked: blocked.filter((g) => g !== id),
      });
    } else {
      this.state.patchFilters({
        blocked: blocked.includes(id) ? blocked.filter((g) => g !== id) : [...blocked, id],
        genres: genres.filter((g) => g !== id),
      });
    }
  }
  protected clearGenres() {
    this.state.patchFilters({ genres: [], blocked: [], match: 'any' });
  }

  protected toggleRelease(r: ReleasePreset) {
    const cur = this.f().release;
    this.state.patchFilters({
      release: cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r],
      years: null,
    });
  }
  protected setYears(from: string, to: string) {
    const a = Number(from);
    const b = Number(to);
    if (!a || !b) {
      this.state.patchFilters({ years: null });
      return;
    }
    this.state.patchFilters({ years: { from: Math.min(a, b), to: Math.max(a, b) }, release: [] });
  }
  protected clearMore() {
    this.state.patchFilters({ release: [], years: null, minRating: 0 });
  }

  async roll() {
    if (this.rolling() || this.busyFor() > 0) return;
    this.message.set(null);
    this.panel.set(null);
    this.rolling.set(true);
    try {
      const result = await this.picker.pull();
      const w = result.winner;
      const details = this.api.title(w.type, w.id, this.state.region()).catch(() => null);
      await this.strip().run(result.reel);
      const number = this.state.pulls() + 1;
      this.state.pulls.set(number);
      this.state.last.set({
        title: w,
        details: null,
        cinemas: result.query.cinemas,
        surprise: result.query.surprise,
        number,
      });
      this.api.event('pull');
      queueMicrotask(() =>
        this.ticketEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      const d = await details;
      const cur = this.state.last();
      if (d && cur && cur.title.id === w.id) this.state.last.set({ ...cur, details: d });
    } catch (e) {
      this.showError(e);
    } finally {
      this.rolling.set(false);
    }
  }

  private showError(e: unknown) {
    if (e instanceof NothingFound) {
      this.message.set(
        this.state.showAll() || !this.state.services().length
          ? 'Nothing matches all of these filters. Try removing one.'
          : 'Nothing matches these filters on your services. Try removing a filter, or turn on "Show everything" in Settings.',
      );
    } else if (e instanceof BusyError) {
      this.startBusy(e.retryAfter);
    } else if (e instanceof OfflineError) {
      this.message.set("You're offline. Connect to the internet to pull a new ticket.");
    } else if (e instanceof ApiError) {
      this.message.set(e.message);
    } else {
      this.message.set('Something went wrong. Try again.');
    }
  }

  private startBusy(seconds: number) {
    this.busyFor.set(Math.min(30, Math.max(1, seconds)));
    if (this.busyTimer) clearInterval(this.busyTimer);
    this.busyTimer = setInterval(() => {
      const n = this.busyFor() - 1;
      this.busyFor.set(Math.max(0, n));
      if (n <= 0 && this.busyTimer) {
        clearInterval(this.busyTimer);
        this.busyTimer = null;
      }
    }, 1000);
  }

  protected skip() {
    const l = this.last();
    if (l) this.picker.skipped.add(`${l.title.type}:${l.title.id}`);
    this.roll();
  }
  protected seen() {
    const l = this.last();
    if (!l) return;
    this.state.markSeen(stub(l.title));
    this.api.event('seen');
    this.roll();
  }
  protected later() {
    const l = this.last();
    if (l) this.state.toggleLater(stub(l.title));
  }
}

const stub = (t: { id: number; type: 'movie' | 'tv'; title: string; poster: string | null }) => ({
  id: t.id,
  type: t.type,
  title: t.title,
  poster: t.poster,
  at: Date.now(),
});
