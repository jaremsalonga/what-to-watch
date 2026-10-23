import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { AppState, type Stub } from '../core/state';
import { POSTER } from '../core/types';
import { Share } from '../share/share';

type Tab = 'later' | 'seen';
const PAGE = 40;

/** The stub book: saved tickets waiting to be watched, and torn stubs for the ones you've seen. */
@Component({
  selector: 'app-stubs',
  imports: [RouterLink],
  templateUrl: './stubs.html',
  styleUrl: './stubs.scss',
})
export class Stubs {
  protected readonly state = inject(AppState);
  private readonly share = inject(Share);
  private readonly api = inject(Api);

  protected readonly tab = signal<Tab>(
    this.state.later().length || !this.state.seen().length ? 'later' : 'seen',
  );
  protected readonly limit = signal(PAGE);
  /** The stub being torn right now, so it can play the tear before it moves to "Seen it". */
  protected readonly tearing = signal<string | null>(null);
  protected readonly list = computed(() =>
    (this.tab() === 'later' ? this.state.later() : this.state.seen()).slice(0, this.limit()),
  );
  protected readonly total = computed(() =>
    this.tab() === 'later' ? this.state.later().length : this.state.seen().length,
  );
  protected readonly name = computed(() => this.state.profile()?.name || 'Admit one');

  protected readonly key = (s: Stub) => `${s.type}:${s.id}`;
  protected readonly poster = (p: string | null) => POSTER(p, 'w185');
  protected readonly date = (at: number) =>
    new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  /** A stable ticket number per title, so each stub looks printed rather than generated. */
  protected readonly number = (s: Stub) => String((s.id * 7919) % 10000).padStart(4, '0');

  protected setTab(t: Tab) {
    this.tab.set(t);
    this.limit.set(PAGE);
  }

  protected tear(s: Stub) {
    if (this.tearing()) return;
    this.tearing.set(this.key(s));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(
      () => {
        this.state.markSeen({ ...s, at: Date.now() });
        this.api.event('seen');
        this.tearing.set(null);
      },
      reduce ? 0 : 650,
    );
  }

  protected remove(s: Stub) {
    this.state.toggleLater(s);
  }

  protected unsee(s: Stub) {
    this.state.unsee(s.id, s.type);
  }

  protected shareStub(s: Stub) {
    this.share.open({
      id: s.id,
      type: s.type,
      title: s.title,
      poster: s.poster,
      year: s.year ?? null,
    });
  }
}
