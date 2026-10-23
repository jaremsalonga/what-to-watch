import { Component, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { Api } from '../core/api';
import { AppState } from '../core/state';
import { Share } from './share';
import { drawStory, VERDICTS, type Verdict } from './story';

/** "Share a story": pick a verdict, add a line, and send a 9:16 card through the share sheet. */
@Component({
  selector: 'app-share-card',
  template: `
    <dialog
      #dialog
      class="share"
      aria-labelledby="share-title"
      (close)="share.close()"
      (click)="backdrop($event)"
    >
      @if (share.item(); as item) {
        <div class="body">
          <header>
            <h2 id="share-title">Share a story</h2>
            <button type="button" class="text" (click)="dialog.close()">Close</button>
          </header>

          <div class="preview">
            <canvas #canvas aria-label="Story card preview"></canvas>
          </div>

          <div class="verdicts" role="group" aria-label="Your verdict">
            @for (v of verdicts; track v.id) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="verdict() === v.id"
                (click)="verdict.set(v.id)"
              >
                {{ v.label }}
              </button>
            }
          </div>

          <label class="note-field">
            <span class="label">One line for your friends (optional)</span>
            <input
              class="field"
              maxlength="80"
              placeholder="Bring tissues."
              [value]="note()"
              (input)="note.set($any($event.target).value)"
            />
          </label>
        </div>

        <footer>
          <button type="button" class="btn" (click)="send(item.title)" [disabled]="busy()">
            {{ busy() ? 'Preparing…' : canShareFiles ? 'Share' : 'Download image' }}
          </button>
          @if (status(); as s) {
            <p class="note" role="status">{{ s }}</p>
          }
        </footer>
      }
    </dialog>
  `,
  styles: `
    dialog {
      padding: 0;
      border: 0;
      color: var(--fg);
      width: 100%;
      max-width: 480px;
      margin: auto auto 0;
      max-height: 94dvh;
      background: var(--night);
      border-top: 1px solid var(--night-3);
      border-radius: 18px 18px 0 0;
      overflow: hidden;
    }
    dialog[open] {
      display: flex;
      flex-direction: column;
      animation: up 280ms var(--ease-out);
    }
    dialog::backdrop {
      background: oklch(0.08 0.02 275 / 0.75);
    }
    @keyframes up {
      from {
        transform: translateY(100%);
      }
    }
    .body {
      overflow-y: auto;
      padding: 14px 16px;
      display: grid;
      gap: 14px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    h2 {
      margin: 0;
      font: 900 1.5rem/1 var(--display);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .text {
      appearance: none;
      border: 0;
      background: none;
      color: var(--lamp);
      font: 600 0.85rem/1 var(--body);
      cursor: pointer;
      padding: 6px 2px;
    }
    .preview {
      display: grid;
      place-items: center;
    }
    canvas {
      height: min(46dvh, 420px);
      aspect-ratio: 9 / 16;
      border-radius: 12px;
      box-shadow: 0 10px 30px oklch(0.05 0 0 / 0.5);
      background: var(--night-2);
    }
    .verdicts {
      display: flex;
      gap: 6px;
      justify-content: center;
    }
    .verdicts .chip {
      flex: 1;
    }
    .note-field {
      display: grid;
      gap: 6px;
    }
    footer {
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--night-3);
      display: grid;
      gap: 8px;
    }
  `,
})
export class ShareCard {
  protected readonly share = inject(Share);
  private readonly state = inject(AppState);
  private readonly api = inject(Api);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly verdicts = VERDICTS;
  protected readonly verdict = signal<Verdict>('must');
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  private drawn: Promise<void> = Promise.resolve();

  constructor() {
    // Open or close the dialog with the shared item.
    effect(() => {
      const item = this.share.item();
      const d = this.dialog().nativeElement;
      if (item && !d.open) {
        untracked(() => {
          this.note.set('');
          this.verdict.set('must');
          this.status.set(null);
        });
        d.showModal();
      } else if (!item && d.open) d.close();
    });
    // Redraw the preview whenever the verdict or note changes.
    effect(() => {
      const item = this.share.item();
      const canvas = this.canvas()?.nativeElement;
      const verdict = this.verdict();
      const note = this.note();
      if (!item || !canvas) return;
      const name = untracked(() => this.state.profile()?.name ?? null);
      this.drawn = drawStory(canvas, item, { name, verdict, note });
    });
  }

  protected backdrop(e: MouseEvent) {
    if (e.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }

  protected async send(title: string) {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) return;
    this.busy.set(true);
    this.status.set(null);
    try {
      await this.drawn;
      let blob: Blob | null;
      try {
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      } catch {
        // The poster host refused CORS, which taints the canvas: share the card without it.
        const name = this.state.profile()?.name ?? null;
        await drawStory(canvas, this.share.item()!, {
          name,
          verdict: this.verdict(),
          note: this.note(),
          posterless: true,
        });
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      }
      if (!blob) throw new Error('no image');
      const file = new File([blob], 'what-to-watch.png', { type: 'image/png' });
      if (this.canShareFiles) {
        await navigator.share({ files: [file], title, text: `${title} · What to Watch?` });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        this.status.set('Saved. Post it to your story from your photos.');
      }
      this.api.event('shared');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        this.status.set("Couldn't make the image. Try again.");
      }
    } finally {
      this.busy.set(false);
    }
  }
}
