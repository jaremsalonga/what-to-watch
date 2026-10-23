import { effect, inject, Injectable, signal } from '@angular/core';
import { Api } from './api';
import { detectRegion } from './region';
import { load, save } from './storage';
import {
  DEFAULT_FILTERS,
  type Filters,
  type MediaType,
  type Title,
  type TitleDetails,
} from './types';

export interface LastPick {
  title: Title;
  details: TitleDetails | null;
  cinemas: boolean;
  surprise: boolean;
  number: number;
}

export interface Stub {
  id: number;
  type: MediaType;
  title: string;
  poster: string | null;
  /** When it was saved or marked seen (epoch ms). */
  at: number;
  year?: number | null;
}

export interface SavedProfile {
  name: string;
  createdAt: number;
  token: string | null;
}

interface Persisted {
  filters: Filters;
  region: string;
  services: number[];
  showAll: boolean;
  onboarded: boolean;
  profile: SavedProfile | null;
  seen: Stub[];
  later: Stub[];
  last: LastPick | null;
  pulls: number;
}

const KEY = 'wtw:v1';

/** Everything the app remembers on this device. One versioned object so it can move later. */
@Injectable({ providedIn: 'root' })
export class AppState {
  private readonly api = inject(Api);
  private readonly initial = load<Persisted>(KEY, {
    filters: DEFAULT_FILTERS,
    region: detectRegion(),
    services: [],
    showAll: false,
    onboarded: false,
    profile: null,
    seen: [],
    later: [],
    last: null,
    pulls: 0,
  });

  readonly filters = signal<Filters>({ ...DEFAULT_FILTERS, ...this.initial.filters });
  readonly region = signal(this.initial.region);
  readonly services = signal<number[]>(this.initial.services);
  readonly showAll = signal(this.initial.showAll);
  readonly onboarded = signal(this.initial.onboarded);
  readonly profile = signal<SavedProfile | null>(this.initial.profile);
  readonly seen = signal<Stub[]>(this.initial.seen);
  readonly later = signal<Stub[]>(this.initial.later);
  readonly last = signal<LastPick | null>(this.initial.last);
  /** Ticket numbers on this device. */
  readonly pulls = signal(this.initial.pulls);

  constructor() {
    this.api.token = this.initial.profile?.token ?? null;
    effect(() => {
      this.api.token = this.profile()?.token ?? null;
      save(KEY, {
        filters: this.filters(),
        region: this.region(),
        services: this.services(),
        showAll: this.showAll(),
        onboarded: this.onboarded(),
        profile: this.profile(),
        seen: this.seen(),
        later: this.later(),
        last: this.last(),
        pulls: this.pulls(),
      } satisfies Persisted);
    });
  }

  patchFilters(patch: Partial<Filters>) {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  isSeen(id: number, type: MediaType) {
    return this.seen().some((s) => s.id === id && s.type === type);
  }
  isLater(id: number, type: MediaType) {
    return this.later().some((s) => s.id === id && s.type === type);
  }

  markSeen(t: Stub) {
    if (this.isSeen(t.id, t.type)) return;
    this.seen.update((list) => [t, ...list].slice(0, 2000));
    this.later.update((list) => list.filter((s) => !(s.id === t.id && s.type === t.type)));
  }
  unsee(id: number, type: MediaType) {
    this.seen.update((l) => l.filter((s) => !(s.id === id && s.type === type)));
  }
  toggleLater(t: Stub) {
    this.later.update((list) =>
      list.some((s) => s.id === t.id && s.type === t.type)
        ? list.filter((s) => !(s.id === t.id && s.type === t.type))
        : [t, ...list].slice(0, 500),
    );
  }
}
