import { Component, inject, signal } from '@angular/core';
import { ApiError, BusyError, Api } from '../core/api';
import { AppState } from '../core/state';
import { ServicesPicker } from '../services/services-picker';

/** First visit: "What should we call you?", then which services you have. */
@Component({
  selector: 'app-onboarding',
  imports: [ServicesPicker],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  protected readonly state = inject(AppState);
  private readonly api = inject(Api);
  protected readonly step = signal<'name' | 'services'>(this.state.profile() ? 'services' : 'name');
  protected readonly name = signal(this.state.profile()?.name ?? '');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async saveName(e: Event) {
    e.preventDefault();
    const name = this.name().trim();
    if (!name) {
      this.error.set('Enter a name, or skip for now.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const p = await this.api.createProfile(name);
      this.state.profile.set({ name: p.name, createdAt: p.createdAt, token: p.token });
      this.step.set('services');
    } catch (err) {
      if (err instanceof BusyError)
        this.error.set(
          `Too many new names from this network. Try again in ${err.retryAfter}s, or skip for now.`,
        );
      else if (err instanceof ApiError && err.status === 400) this.error.set(err.message);
      else {
        // Server unreachable: keep the name on this device so tickets still show it.
        this.state.profile.set({ name: name.slice(0, 20), createdAt: Date.now(), token: null });
        this.step.set('services');
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected finish() {
    this.state.onboarded.set(true);
  }
}
