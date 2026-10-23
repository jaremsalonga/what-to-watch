import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AppState } from './core/state';
import { Onboarding } from './onboarding/onboarding';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Onboarding],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly state = inject(AppState);
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
    { path: '/settings', label: 'Settings', exact: false },
    { path: '/about', label: 'About', exact: false },
  ];
}
