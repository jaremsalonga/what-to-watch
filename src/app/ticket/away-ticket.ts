import { Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AppState } from '../core/state';
import { Ticket } from './ticket';
import { TicketDesk } from './ticket-desk';

/** The ticket pop-up for a roll that landed after you left the booth, over whatever page is open. */
@Component({
  selector: 'app-away-ticket',
  imports: [Ticket],
  template: `
    <dialog
      #dialog
      class="reveal"
      aria-label="Your ticket"
      (click)="backdrop($event)"
      (close)="desk.away.set(false)"
    >
      @if (desk.away()) {
        @if (state.last(); as l) {
          <div class="reveal-inner">
            <button type="button" class="close" (click)="dialog.close()">Close</button>
            <app-ticket
              [title]="l.title"
              [details]="l.details"
              [services]="state.services()"
              [name]="state.profile()?.name ?? null"
              [cinemas]="l.cinemas"
              [surprise]="l.surprise"
              [number]="l.number"
              [because]="l.because ?? null"
              [isLater]="state.isLater(l.title.id, l.title.type)"
              [detailsFailed]="desk.detailsFailed()"
              (again)="rollAgain()"
              (skip)="desk.skip(); rollAgain()"
              (seen)="desk.seen(); rollAgain()"
              (later)="desk.later()"
              (share)="desk.openShare()"
              (retry)="desk.retryDetails()"
            />
          </div>
        }
      }
    </dialog>
  `,
  styles: `
    dialog {
      padding: 0;
      border: 0;
      color: var(--fg);
      max-width: 480px;
      width: calc(100% - 24px);
      margin: auto;
      max-height: 94dvh;
      background: transparent;
      overflow: visible;
    }
    dialog[open]::backdrop {
      background: oklch(0.08 0.02 275 / 0.82);
      animation: fade 240ms var(--ease-out);
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    .reveal-inner {
      position: relative;
      max-height: 94dvh;
      overflow-y: auto;
      border-radius: 14px;
      overscroll-behavior: contain;
      animation: print 520ms var(--ease-out);
      transform-origin: 50% 0;
    }
    @keyframes print {
      from {
        opacity: 0;
        transform: translateY(40px) rotate(-2.5deg) scale(0.96);
      }
      60% {
        opacity: 1;
      }
    }
    .close {
      display: block;
      margin: 0 0 10px auto;
      appearance: none;
      border: 1px solid var(--night-3);
      border-radius: 999px;
      background: var(--night-2);
      color: var(--fg);
      font: 600 0.8rem/1 var(--body);
      padding: 0.6rem 0.9rem;
      cursor: pointer;
    }
  `,
})
export class AwayTicket {
  protected readonly desk = inject(TicketDesk);
  protected readonly state = inject(AppState);
  private readonly router = inject(Router);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const d = this.dialog().nativeElement;
      if (this.desk.away() && !d.open) d.showModal();
      else if (!this.desk.away() && d.open) d.close();
    });
  }

  protected backdrop(e: MouseEvent) {
    if (e.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }

  /** Rolling needs the booth's projector, so go back to it and roll there. */
  protected rollAgain() {
    this.desk.rollRequest.set(this.desk.lastWasSurprise);
    this.desk.away.set(false);
    void this.router.navigate(['/']);
  }
}
