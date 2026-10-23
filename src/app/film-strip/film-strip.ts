import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { POSTER, type Title } from '../core/types';

const FRAME = 150; // frame height (144) + gap (6)
const SPIN_MS = 3000;

/** The projector gate: posters run past on a film strip and slow to a stop on the winner. */
@Component({
  selector: 'app-film-strip',
  templateUrl: './film-strip.html',
  styleUrl: './film-strip.scss',
})
export class FilmStrip {
  /** Shown while idle (the last ticket's poster, if any). */
  readonly idle = input<Title | null>(null);
  protected readonly frames = signal<Title[]>([]);
  protected readonly running = signal(false);
  private readonly strip = viewChild.required<ElementRef<HTMLElement>>('strip');
  private readonly gate = viewChild.required<ElementRef<HTMLElement>>('gate');
  protected readonly poster = POSTER;

  /** Runs the strip and resolves when it has stopped on the last frame. */
  async run(reel: Title[]): Promise<void> {
    this.frames.set(reel);
    this.running.set(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const el = this.strip().nativeElement;
    const gateH = this.gate().nativeElement.clientHeight;
    const last = reel.length - 1;
    const target = last * FRAME - (gateH - 144) / 2 + 6;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = el.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${-target}px)` }],
      {
        duration: reduce ? 300 : SPIN_MS,
        easing: reduce ? 'ease-out' : 'cubic-bezier(0.1, 0.75, 0.15, 1)',
        fill: 'forwards',
      },
    );
    try {
      await anim.finished;
    } catch {
      // Cancelled (navigated away): nothing to do.
    }
    this.running.set(false);
  }
}
