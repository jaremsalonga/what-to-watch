import { Component, effect, inject, input, signal } from '@angular/core';
import { Api } from '../core/api';
import { AppState } from '../core/state';
import { POSTER, type Provider } from '../core/types';

/** Grid of streaming services for the viewer's country, plus the "Show everything" switch. */
@Component({
  selector: 'app-services-picker',
  template: `
    @if (loading()) {
      <p class="note">Loading services for {{ state.region() }}…</p>
    } @else if (error()) {
      <p class="alert">{{ error() }}</p>
    } @else {
      <div class="grid" role="group" aria-label="Your streaming services">
        @for (p of shown(); track p.id) {
          <button
            type="button"
            class="svc"
            [attr.aria-pressed]="state.services().includes(p.id)"
            (click)="toggle(p.id)"
          >
            @if (logo(p.logo); as src) {
              <img [src]="src" alt="" width="28" height="28" />
            }
            <span>{{ p.name }}</span>
          </button>
        }
      </div>
      @if (providers().length > limit()) {
        <button type="button" class="more" (click)="all.set(!all())">
          {{ all() ? 'Show fewer' : 'Show all ' + providers().length + ' services' }}
        </button>
      }
    }
    <label class="switch">
      <input
        type="checkbox"
        [checked]="state.showAll()"
        (change)="state.showAll.set($any($event.target).checked)"
      />
      <span
        ><b>Show everything</b><br /><small
          >Pull from all titles and just label where each one streams.</small
        ></span
      >
    </label>
  `,
  styles: `
    :host {
      display: grid;
      gap: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 140px), 1fr));
      gap: 6px;
    }
    .svc {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px;
      text-align: left;
      border: 1px solid var(--night-3);
      border-radius: 8px;
      background: transparent;
      color: var(--fg);
      font: 600 0.8rem/1.2 var(--body);
      cursor: pointer;
      min-width: 0;
    }
    .svc span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .svc img {
      border-radius: 6px;
      flex: none;
    }
    .svc[aria-pressed='true'] {
      background: var(--ticket);
      color: var(--ticket-ink);
      border-color: var(--ticket);
    }
    .more {
      justify-self: start;
      background: none;
      border: 0;
      color: var(--lamp);
      font: 600 0.82rem/1 var(--body);
      cursor: pointer;
      padding: 4px 0;
    }
    .switch {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .switch input {
      width: 20px;
      height: 20px;
      accent-color: var(--lamp);
      margin-top: 2px;
      flex: none;
    }
    .switch small {
      color: var(--dim);
    }
  `,
})
export class ServicesPicker {
  protected readonly state = inject(AppState);
  private readonly api = inject(Api);
  readonly limit = input(16);
  protected readonly providers = signal<Provider[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly all = signal(false);
  protected readonly logo = (p: string | null) => POSTER(p, 'w92');

  constructor() {
    effect(() => {
      const region = this.state.region();
      this.loading.set(true);
      this.error.set(null);
      this.api
        .providers(region)
        .then((r) => this.providers.set(r.providers))
        .catch(() =>
          this.error.set(
            "Couldn't load streaming services right now. You can still use Show everything.",
          ),
        )
        .finally(() => this.loading.set(false));
    });
  }

  protected shown() {
    const list = this.providers();
    const mine = new Set(this.state.services());
    if (this.all()) return list;
    // Keep any already-picked services visible even if they rank lower.
    return [
      ...list.slice(0, this.limit()),
      ...list.slice(this.limit()).filter((p) => mine.has(p.id)),
    ];
  }

  protected toggle(id: number) {
    this.state.services.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    if (this.state.services().length) this.state.showAll.set(false);
  }
}
