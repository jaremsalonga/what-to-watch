import { Component, inject, OnInit, signal } from '@angular/core';
import { Api, ApiError, BusyError } from '../core/api';
import { AppState } from '../core/state';
import { POSTER } from '../core/types';
import { ServicesPicker } from '../services/services-picker';

@Component({
  selector: 'app-settings',
  imports: [ServicesPicker],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  protected readonly state = inject(AppState);
  private readonly api = inject(Api);
  protected readonly regions = signal<{ code: string; name: string }[]>([]);
  protected readonly nameDraft = signal(this.state.profile()?.name ?? '');
  protected readonly status = signal<string | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly poster = (p: string | null) => POSTER(p, 'w92');

  ngOnInit() {
    this.api
      .regions()
      .then((r) => this.regions.set(r.regions))
      .catch(() => this.regions.set([{ code: this.state.region(), name: this.state.region() }]));
  }

  protected setRegion(code: string) {
    if (code === this.state.region()) return;
    this.state.region.set(code);
    this.state.services.set([]);
  }

  protected async saveName(e: Event) {
    e.preventDefault();
    const name = this.nameDraft().trim();
    if (!name || name === this.state.profile()?.name) return;
    try {
      const p = await this.api.createProfile(name);
      this.state.profile.set({ name: p.name, createdAt: p.createdAt, token: p.token });
      this.status.set('Name saved.');
    } catch (err) {
      this.status.set(
        err instanceof BusyError
          ? `Too many new names from this network. Try again in ${err.retryAfter}s.`
          : err instanceof ApiError
            ? err.message
            : "Couldn't reach the server. Try again later.",
      );
    }
  }

  protected async deleteName() {
    try {
      if (this.state.profile()?.token) await this.api.deleteProfile();
    } catch {
      // Already gone or unreachable: forget it on this device anyway.
    }
    this.state.profile.set(null);
    this.nameDraft.set('');
    this.confirmDelete.set(false);
    this.status.set('Your name was deleted.');
  }

  protected forgetSeen(id: number, type: 'movie' | 'tv') {
    this.state.seen.update((l) => l.filter((s) => !(s.id === id && s.type === type)));
  }
}
