import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AppState } from './core/state';
import { Sound } from './core/sound';
import { Updates } from './core/updates';
import { Onboarding } from './onboarding/onboarding';
import { ShareCard } from './share/share-card';
import { AwayTicket } from './ticket/away-ticket';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Onboarding, ShareCard, AwayTicket],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly state = inject(AppState);
  protected readonly sound = inject(Sound);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: '/' },
  );
  protected readonly isAdmin = computed(() => this.url().startsWith('/admin'));
  protected readonly nav = [
    { path: '/', label: 'Booth', exact: true },
    { path: '/stubs', label: 'Stubs', exact: false },
    { path: '/settings', label: 'Settings', exact: false },
    { path: '/about', label: 'About', exact: false },
  ];
  protected readonly stubCount = computed(() => this.state.later().length);

  constructor() {
    inject(Updates).start();
    // Browsers only allow audio after a tap, so the lobby music starts on the first one,
    // anywhere in the app, and then keeps playing in the background. iOS only counts some
    // gestures (touchend and click, not touchstart), so listen to all of them until it plays.
    if (typeof document === 'undefined') return;
    const events = ['pointerup', 'touchend', 'click', 'keydown'];
    const start = () => {
      if (this.isAdmin()) return;
      this.sound.unlock();
      if (this.sound.running || this.sound.muted())
        for (const e of events) document.removeEventListener(e, start, true);
    };
    for (const e of events) document.addEventListener(e, start, true);
  }
}
