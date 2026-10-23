import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { TicketDesk } from '../ticket/ticket-desk';

/**
 * Keeps the installed app current. The service worker downloads a new version in the background;
 * without this, the old one keeps running until the app is closed twice. A new version is applied
 * right away if it arrives in the first few seconds, otherwise on the next page change or when the
 * app comes back from the background, so a roll or an open ticket is never cut off.
 */
@Injectable({ providedIn: 'root' })
export class Updates {
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly router = inject(Router);
  private readonly desk = inject(TicketDesk);
  private ready = false;
  private readonly started = Date.now();

  start() {
    const sw = this.sw;
    if (!sw?.isEnabled || typeof document === 'undefined') return;
    sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => {
      this.ready = true;
      if (Date.now() - this.started < 4000) this.apply();
    });
    sw.unrecoverable.subscribe(() => location.reload());
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      // "Roll again" from a ticket navigates to the booth to roll: don't reload under it.
      if (this.ready && this.desk.rollRequest() === null) this.apply();
    });
    // iOS resumes an installed app without reloading it, so look for a new version on return.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (this.ready) this.apply();
      else void sw.checkForUpdate().catch(() => undefined);
    });
  }

  private apply() {
    this.ready = false;
    void this.sw?.activateUpdate().then(() => location.reload());
  }
}
