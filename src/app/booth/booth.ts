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
import { LANGUAGES, MOODS, MOVIE_GENRES, RELEASES, TIMES } from '../core/moods';
import { NothingFound, Picker } from '../core/picker';
import { Sound } from '../core/sound';
import { AppState } from '../core/state';
import type { Genre, Mood, ReleasePreset, TimeChoice, TypeChoice } from '../core/types';
import { FilmStrip } from '../film-strip/film-strip';
import { Ticket } from '../ticket/ticket';
import { TicketDesk } from '../ticket/ticket-desk';
import { Dinner } from '../dinner/dinner';

/** One active "refine" filter, shown as a removable chip under the quick filters. */
interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

@Component({
  selector: 'app-booth',
  imports: [FilmStrip, Ticket, RouterLink],
  templateUrl: './booth.html',
  styleUrl: './booth.scss',
})
export class Booth implements OnInit, OnDestroy {
  protected readonly state = inject(AppState);
  protected readonly sound = inject(Sound);
  private readonly api = inject(Api);
  private readonly picker = inject(Picker);
  private readonly strip = viewChild.required(FilmStrip);
  private readonly sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');
  private readonly reveal = viewChild.required<ElementRef<HTMLDialogElement>>('reveal');

  protected readonly moods = MOODS.filter((m) => m.id !== 'surprise');
  protected readonly times = TIMES;
  protected readonly releases = RELEASES;
  protected readonly languages = LANGUAGES;
  protected readonly types: { id: TypeChoice; label: string }[] = [
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'Series' },
    { id: 'both', label: 'Both' },
  ];
  protected readonly ratings = [0, 6, 7, 8];
  protected readonly genreList = signal<Genre[]>(MOVIE_GENRES);
  protected readonly rolling = signal(false);
  protected readonly showTicket = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly busyFor = signal(0);
  protected readonly desk = inject(TicketDesk);
  protected readonly dinner = inject(Dinner);
  private destroyed = false;
  /** "Roll again" on a hidden gem rolls another hidden gem. */
  private busyTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly f = this.state.filters;
  protected readonly last = this.state.last;
  protected readonly years = Array.from(
    { length: new Date().getFullYear() - 1919 },
    (_, i) => new Date().getFullYear() - i,
  );

  protected readonly cinemasOnly = computed(
    () => this.f().release.length === 1 && this.f().release[0] === 'cinemas',
  );
  /** Where picks must be watchable: the viewer's services, any streaming service, or anywhere. */
  protected readonly availability = computed<'mine' | 'streaming' | 'any'>(() =>
    this.state.services().length && !this.state.showAll()
      ? 'mine'
      : this.f().streamOnly
        ? 'streaming'
        : 'any',
  );
  protected readonly servicesLine = computed(() => {
    const region = this.state.region();
    if (this.cinemasOnly()) return 'Showing films in cinemas near you';
    if (this.availability() === 'mine') {
      const n = this.state.services().length;
      return `Streaming on your ${n} service${n > 1 ? 's' : ''} in ${region}`;
    }
    if (this.availability() === 'streaming') return `Streaming on any service in ${region}`;
    return 'Everything, streaming or not';
  });

  /** Everything set inside the Filters sheet, as removable chips. */
  protected readonly active = computed<ActiveFilter[]>(() => {
    const f = this.f();
    const name = (id: number) => this.genreList().find((g) => g.id === id)?.name ?? 'Genre';
    const out: ActiveFilter[] = [];
    for (const id of f.genres)
      out.push({
        key: `g${id}`,
        label: name(id),
        remove: () => this.setGenre(id, 'off'),
      });
    for (const id of f.blocked)
      out.push({
        key: `b${id}`,
        label: `No ${name(id).toLowerCase()}`,
        remove: () => this.setGenre(id, 'off'),
      });
    for (const r of f.release)
      out.push({
        key: `r${r}`,
        label: RELEASES.find((x) => x.id === r)?.label ?? r,
        remove: () => this.toggleRelease(r),
      });
    for (const id of f.languages ?? [])
      out.push({
        key: `l${id}`,
        label: LANGUAGES.find((x) => x.id === id)?.label ?? id,
        remove: () => this.toggleLanguage(id),
      });
    if (f.years)
      out.push({
        key: 'years',
        label: f.years.from === f.years.to ? `${f.years.from}` : `${f.years.from}–${f.years.to}`,
        remove: () => this.state.patchFilters({ years: null }),
      });
    if (f.minRating)
      out.push({
        key: 'rating',
        label: `${f.minRating}★ and up`,
        remove: () => this.state.patchFilters({ minRating: 0 }),
      });
    return out;
  });

  ngOnInit() {
    // "Surprise me" used to be a mood; it is a separate button now.
    if (this.f().mood === 'surprise') this.state.patchFilters({ mood: null });
    this.api
      .genres('movie')
      .then((r) => r.genres.length && this.genreList.set(r.genres))
      .catch(() => undefined);
    // "Roll again" on a ticket shown away from the booth: roll as soon as the projector is ready.
    const request = this.desk.rollRequest();
    if (request !== null) {
      this.desk.rollRequest.set(null);
      setTimeout(() => this.roll(request));
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.busyTimer) clearInterval(this.busyTimer);
    // Leaving mid-roll: the music goes back to lobby level and the roll stops making sounds.
    if (this.rolling()) this.sound.boost(false);
  }

  protected setMood(m: Mood) {
    this.state.patchFilters({ mood: this.f().mood === m ? null : m });
  }
  protected setTime(t: string) {
    this.state.patchFilters({ time: t as TimeChoice });
  }
  protected setType(t: TypeChoice) {
    this.state.patchFilters({ type: t });
  }

  protected setAvailability(a: 'mine' | 'streaming' | 'any') {
    this.state.showAll.set(a !== 'mine');
    this.state.patchFilters({ streamOnly: a !== 'any' });
  }

  protected openFilters() {
    this.sheet().nativeElement.showModal();
  }
  protected closeFilters() {
    this.sheet().nativeElement.close();
  }
  /** Taps on the dimmed backdrop (the dialog element itself) close it. */
  protected backdrop(e: MouseEvent, dialog: HTMLDialogElement) {
    if (e.target === dialog) dialog.close();
  }

  protected genreState(id: number): 'on' | 'blocked' | 'off' {
    if (this.f().genres.includes(id)) return 'on';
    if (this.f().blocked.includes(id)) return 'blocked';
    return 'off';
  }
  /** One tap: want it. Second tap: never show it. Third tap: back to neutral. */
  protected tapGenre(id: number) {
    const next = { off: 'on', on: 'blocked', blocked: 'off' } as const;
    this.setGenre(id, next[this.genreState(id)]);
  }
  private setGenre(id: number, to: 'on' | 'blocked' | 'off') {
    const { genres, blocked } = this.f();
    const g = genres.filter((x) => x !== id);
    const b = blocked.filter((x) => x !== id);
    this.state.patchFilters({
      genres: to === 'on' ? [...g, id] : g,
      blocked: to === 'blocked' ? [...b, id] : b,
      ...(g.length + (to === 'on' ? 1 : 0) < 2 ? { match: 'any' as const } : {}),
    });
  }

  protected toggleRelease(r: ReleasePreset) {
    const cur = this.f().release;
    this.state.patchFilters({
      release: cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r],
      years: null,
    });
  }
  protected toggleLanguage(id: string) {
    const cur = this.f().languages ?? [];
    this.state.patchFilters({
      languages: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
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
  protected resetFilters() {
    this.state.patchFilters({
      genres: [],
      blocked: [],
      match: 'any',
      release: [],
      years: null,
      minRating: 0,
      languages: [],
    });
  }

  protected openTicket() {
    const d = this.reveal().nativeElement;
    if (!d.open) d.showModal();
    this.showTicket.set(true);
    if (!this.rolling() && !this.last()?.details) void this.desk.retryDetails();
  }
  protected closeTicket() {
    const d = this.reveal().nativeElement;
    if (d.open) d.close();
    this.showTicket.set(false);
  }

  async roll(surprise = false) {
    if (this.rolling() || this.busyFor() > 0) return;
    this.closeTicket();
    this.message.set(null);
    this.rolling.set(true);
    this.desk.lastWasSurprise = surprise;
    this.sound.startMusic();
    this.sound.boost(true);
    try {
      const result = await this.strip().countdown(
        this.picker.pull(Math.random, surprise),
        () => !this.destroyed && this.sound.beep(),
      );
      if (this.destroyed) return;
      const w = result.winner;
      const details = this.desk.fetchDetails(w);
      await this.strip().run(result.reel, () => {
        if (this.destroyed) return;
        this.sound.tick();
        navigator.vibrate?.(4);
      });
      this.sound.boost(false);
      this.sound.ding();
      navigator.vibrate?.([20, 40, 30]);
      const number = this.state.pulls() + 1;
      this.state.pulls.set(number);
      this.desk.detailsFailed.set(false);
      this.state.last.set({
        title: w,
        details: null,
        cinemas: result.query.cinemas,
        surprise: result.query.surprise,
        number,
        because: result.because ?? null,
      });
      this.dinner.forNewTicket();
      this.api.event('pull');
      // Left the booth mid-roll: the app shows the ticket over whatever page is open.
      if (this.destroyed) this.desk.away.set(true);
      else this.openTicket();
      this.desk.applyDetails(w, await details);
    } catch (e) {
      this.sound.boost(false);
      this.showError(e);
    } finally {
      this.rolling.set(false);
    }
  }

  protected again() {
    this.roll(this.desk.lastWasSurprise);
  }

  private showError(e: unknown) {
    if (e instanceof NothingFound) {
      this.message.set(
        this.availability() === 'mine'
          ? 'Nothing matches these filters on your services. Try removing a filter, or choose "Any service" under Filters.'
          : 'Nothing matches all of these filters. Try removing one.',
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
    this.desk.skip();
    this.again();
  }
  protected seen() {
    if (!this.last()) return;
    this.desk.seen();
    this.again();
  }
}
