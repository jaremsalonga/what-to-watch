import { inject, Injectable, signal } from '@angular/core';
import { Api, ApiError, BusyError, OfflineError } from '../core/api';
import { Picker } from '../core/picker';
import { AppState, type Stub } from '../core/state';
import type { Title, TitleDetails } from '../core/types';
import { Share } from '../share/share';

/**
 * Everything the printed ticket does, shared by the booth and the app shell: loading where it
 * streams, saving, seen, skip and share. A roll that lands after you left the booth shows its
 * ticket over whatever page you're on (`away`), and asks the booth to roll again from there.
 */
@Injectable({ providedIn: 'root' })
export class TicketDesk {
  private readonly api = inject(Api);
  private readonly state = inject(AppState);
  private readonly picker = inject(Picker);
  private readonly share = inject(Share);

  /** The ticket's details couldn't be loaded, so it offers a retry instead of "Checking…". */
  readonly detailsFailed = signal(false);
  /** A roll landed while the booth wasn't on screen: the app shell shows the ticket. */
  readonly away = signal(false);
  /** Set by the away ticket's "Roll again"; the booth picks it up when it opens (value: surprise). */
  readonly rollRequest = signal<boolean | null>(null);
  lastWasSurprise = false;
  private loading = false;

  /**
   * Where it streams. The pull just used up part of the per-second limit, so a "busy" answer
   * waits and tries again, and any other failure gets one more try.
   */
  async fetchDetails(w: Title): Promise<TitleDetails | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.api.title(w.type, w.id, this.state.region());
      } catch (e) {
        if (e instanceof OfflineError || (e instanceof ApiError && e.status === 400)) break;
        const wait = e instanceof BusyError ? e.retryAfter * 1000 : 1200;
        await new Promise((r) => setTimeout(r, Math.min(wait, 4000)));
      }
    }
    return null;
  }

  applyDetails(w: Title, d: TitleDetails | null) {
    const cur = this.state.last();
    if (!cur || cur.title.id !== w.id || cur.title.type !== w.type) return;
    if (d) {
      this.detailsFailed.set(false);
      this.state.last.set({ ...cur, details: d });
    } else this.detailsFailed.set(true);
  }

  /** "Try again" on the ticket, or a saved ticket reopened before its details arrived. */
  async retryDetails() {
    const l = this.state.last();
    if (!l || l.details || this.loading) return;
    this.loading = true;
    this.detailsFailed.set(false);
    try {
      this.applyDetails(l.title, await this.fetchDetails(l.title));
    } finally {
      this.loading = false;
    }
  }

  skip() {
    const l = this.state.last();
    if (l) this.picker.skipped.add(`${l.title.type}:${l.title.id}`);
  }
  seen() {
    const l = this.state.last();
    if (!l) return;
    this.state.markSeen(stub(l.title));
    this.api.event('seen');
  }
  later() {
    const l = this.state.last();
    if (l) this.state.toggleLater(stub(l.title));
  }
  openShare() {
    const l = this.state.last();
    if (!l) return;
    const d = l.details;
    this.share.open({
      id: l.title.id,
      type: l.title.type,
      title: l.title.title,
      poster: d?.poster ?? l.title.poster,
      year: d?.year ?? l.title.year,
      rating: d?.rating ?? l.title.rating,
      genres: d?.genres,
    });
  }
}

export const stub = (t: Title): Stub => ({
  id: t.id,
  type: t.type,
  title: t.title,
  poster: t.poster,
  year: t.year,
  genres: t.genres,
  at: Date.now(),
});
