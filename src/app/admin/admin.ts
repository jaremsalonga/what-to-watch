import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Api, ApiError, BusyError, type AdminStats } from '../core/api';

/** Private page: who's using the app. Not linked anywhere; needs ADMIN_PASSWORD. */
@Component({
  selector: 'app-admin',
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private readonly api = inject(Api);
  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly needsLogin = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly password = signal('');
  protected readonly confirmId = signal<string | null>(null);
  protected readonly maxPulls = computed(() =>
    Math.max(1, ...(this.stats()?.days.map((d) => d.pulls) ?? [1])),
  );

  ngOnInit() {
    this.load();
  }

  protected async load() {
    try {
      this.stats.set(await this.api.admin());
      this.needsLogin.set(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) this.needsLogin.set(true);
      else this.error.set(e instanceof ApiError ? e.message : "Couldn't load stats.");
    }
  }

  protected async login(ev: Event) {
    ev.preventDefault();
    this.error.set(null);
    try {
      await this.api.adminAction({ action: 'login', password: this.password() });
      this.password.set('');
      await this.load();
    } catch (e) {
      this.error.set(
        e instanceof BusyError
          ? `Too many attempts. Try again in ${Math.ceil(e.retryAfter / 60)} min.`
          : e instanceof ApiError
            ? e.message
            : 'Sign-in failed.',
      );
    }
  }

  protected async logout() {
    await this.api.adminAction({ action: 'logout' }).catch(() => undefined);
    this.stats.set(null);
    this.needsLogin.set(true);
  }

  protected async remove(id: string) {
    await this.api.adminAction({ action: 'delete', id }).catch(() => undefined);
    this.confirmId.set(null);
    await this.load();
  }

  protected ago(ms: number) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }

  protected date(ms: number) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
