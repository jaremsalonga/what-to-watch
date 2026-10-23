import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { POSTER, type Title } from '../core/types';

const SPIN_MS = 3200;
const LEVER_TRAVEL = 96;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The projector: pull the lever (or swipe the film down) to roll. A 3-2-1 film leader counts
 * down while the pick loads, then posters run through the gate and slow to a stop on the winner.
 */
@Component({
  selector: 'app-film-strip',
  templateUrl: './film-strip.html',
  styleUrl: './film-strip.scss',
})
export class FilmStrip {
  /** Shown while idle (the last ticket's poster, if any). */
  readonly idle = input<Title | null>(null);
  /** True while a roll can't start (rolling, or the booth is busy). */
  readonly locked = input(false);
  /** The viewer pulled the lever or swiped the film. */
  readonly pull = output<void>();

  protected readonly frames = signal<Title[]>([]);
  protected readonly running = signal(false);
  protected readonly landed = signal(false);
  protected readonly count = signal<number | null>(null);
  protected readonly lever = signal(0);
  protected readonly dragging = signal(false);
  private readonly strip = viewChild.required<ElementRef<HTMLElement>>('strip');
  private readonly gate = viewChild.required<ElementRef<HTMLElement>>('gate');
  protected readonly poster = POSTER;
  private drag: { y: number; from: 'lever' | 'gate' } | null = null;

  /** Shows the film leader (3, 2, 1) until `ready` settles, at least once through. */
  async countdown<T>(ready: Promise<T>, onBeat?: () => void): Promise<T> {
    this.landed.set(false);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let done = false;
    ready.then(
      () => (done = true),
      () => (done = true),
    );
    try {
      for (let n = 3; n >= 1 && !reduce; n--) {
        this.count.set(n);
        onBeat?.();
        await pause(380);
        // Hold on 1 until the pick has loaded.
        while (n === 1 && !done) await pause(60);
      }
      return await ready;
    } finally {
      this.count.set(null);
    }
  }

  /**
   * Runs the strip and resolves when it has stopped on the last frame.
   * `onFrame` fires each time a new frame enters the gate (for the projector click).
   */
  async run(reel: Title[], onFrame?: () => void): Promise<void> {
    this.frames.set(reel);
    this.landed.set(false);
    this.running.set(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const el = this.strip().nativeElement;
    const gateH = this.gate().nativeElement.clientHeight;
    // Frame size comes from CSS (smaller on short screens).
    const first = el.firstElementChild as HTMLElement;
    const frameH = first.offsetHeight;
    const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
    const FRAME = frameH + gap;
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const last = reel.length - 1;
    const target = last * FRAME - (gateH - frameH) / 2 + pad;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = el.animate(
      [
        { transform: 'translateY(0)', filter: 'blur(0)' },
        { filter: 'blur(1.6px)', offset: 0.12 },
        { filter: 'blur(1px)', offset: 0.55 },
        { transform: `translateY(${-target}px)`, filter: 'blur(0)' },
      ],
      {
        duration: reduce ? 300 : SPIN_MS,
        easing: reduce ? 'ease-out' : 'cubic-bezier(0.12, 0.7, 0.16, 1)',
        fill: 'forwards',
      },
    );

    let lastFrame = 0;
    const watch = () => {
      if (anim.playState !== 'running') return;
      const y = -new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
      const frame = Math.floor((y + gateH / 2) / FRAME);
      if (frame !== lastFrame) {
        lastFrame = frame;
        onFrame?.();
      }
      requestAnimationFrame(watch);
    };
    if (onFrame && !reduce) requestAnimationFrame(watch);

    try {
      await anim.finished;
    } catch {
      // Cancelled (navigated away): nothing to do.
    }
    this.running.set(false);
    this.landed.set(true);
  }

  // Lever and swipe: drag down far enough and let go to roll. A plain tap on the lever works too.
  protected down(e: PointerEvent, from: 'lever' | 'gate') {
    if (this.locked()) return;
    this.drag = { y: e.clientY, from };
    this.dragging.set(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  protected move(e: PointerEvent) {
    if (!this.drag) return;
    this.lever.set(Math.max(0, Math.min(LEVER_TRAVEL, e.clientY - this.drag.y)));
  }
  protected up() {
    if (!this.drag) return;
    const { from } = this.drag;
    const pulled = this.lever() > LEVER_TRAVEL * 0.55;
    const tapped = from === 'lever' && this.lever() < 6;
    this.drag = null;
    this.dragging.set(false);
    if (pulled || tapped) {
      this.lever.set(LEVER_TRAVEL);
      navigator.vibrate?.(15);
      this.pull.emit();
    }
    // Spring back after the clunk.
    setTimeout(() => this.lever.set(0), pulled || tapped ? 160 : 0);
  }
  protected key(e: Event) {
    if (this.locked()) return;
    e.preventDefault();
    this.lever.set(LEVER_TRAVEL);
    this.pull.emit();
    setTimeout(() => this.lever.set(0), 160);
  }
}
