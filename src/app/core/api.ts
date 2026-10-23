import { Injectable } from '@angular/core';
import type { Genre, MediaType, Provider, PullPage, TitleDetails } from './types';

export class BusyError extends Error {
  constructor(public retryAfter: number) {
    super('busy');
  }
}
export class OfflineError extends Error {}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Talks to our own /api proxy. The TMDB key never reaches the browser. */
@Injectable({ providedIn: 'root' })
export class Api {
  token: string | null = null;

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(init.headers as Record<string, string>),
    };
    if (this.token) headers['x-wtw-token'] = this.token;
    let res: Response;
    try {
      res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
    } catch {
      throw new OfflineError('offline');
    }
    if (res.status === 429) throw new BusyError(Number(res.headers.get('retry-after') ?? 1) || 1);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, body?.error ?? 'Something went wrong.');
    return body as T;
  }

  private post<T>(path: string, body: unknown, method = 'POST') {
    return this.request<T>(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  pull(query: string, page: number) {
    return this.request<PullPage>(`/api/pull?${query}&page=${page}`);
  }
  title(type: MediaType, id: number, region: string) {
    return this.request<TitleDetails>(`/api/title?type=${type}&id=${id}&region=${region}`);
  }
  genres(type: MediaType) {
    return this.request<{ genres: Genre[] }>(`/api/meta?kind=genres&type=${type}`);
  }
  providers(region: string) {
    return this.request<{ region: string; providers: Provider[] }>(
      `/api/meta?kind=providers&type=movie&region=${region}`,
    );
  }
  regions() {
    return this.request<{ regions: { code: string; name: string }[] }>(`/api/meta?kind=regions`);
  }
  createProfile(name: string) {
    return this.post<{
      id: string;
      name: string;
      createdAt: number;
      token: string;
      reused: boolean;
    }>('/api/profile', { name });
  }
  deleteProfile() {
    return this.request<{ deleted: boolean }>('/api/profile', { method: 'DELETE' });
  }
  event(kind: 'pull' | 'seen' | 'shared') {
    return this.post<{ ok: boolean }>('/api/event', { kind }).catch(() => undefined);
  }
  admin() {
    return this.request<AdminStats>('/api/admin');
  }
  adminAction(
    body:
      | { action: 'login'; password: string }
      | { action: 'logout' }
      | { action: 'delete'; id: string },
  ) {
    return this.post<{ ok?: boolean; deleted?: boolean }>('/api/admin', body);
  }
}

export interface AdminStats {
  persistent: boolean;
  totals: { profiles: number; activeWeek: number; newWeek: number; pullsToday: number };
  days: { day: string; pulls: number; blocked: number }[];
  profiles: {
    id: string;
    name: string;
    createdAt: number;
    lastSeen: number;
    pulls: number;
    seen: number;
    shared: number;
  }[];
}
