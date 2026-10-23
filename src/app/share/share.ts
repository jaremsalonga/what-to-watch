import { Injectable, signal } from '@angular/core';
import type { MediaType } from '../core/types';

/** What the story card shows. Built from a ticket or a stub. */
export interface ShareItem {
  id: number;
  type: MediaType;
  title: string;
  poster: string | null;
  year: number | null;
  rating?: number | null;
  genres?: string[];
}

/** Opens the "Share a story" sheet from anywhere (the ticket pop-up or the stub book). */
@Injectable({ providedIn: 'root' })
export class Share {
  readonly item = signal<ShareItem | null>(null);

  open(item: ShareItem) {
    this.item.set(item);
  }
  close() {
    this.item.set(null);
  }
}
