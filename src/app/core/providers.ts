import type { ProviderRef } from './types';

/**
 * The name a service goes by, without its plan or the store selling it: "Netflix Standard with
 * Ads", "Netflix basic with Ads" and "Netflix" are one service, and so are "Paramount+" and
 * "Paramount Plus Apple TV Channel".
 */
export function serviceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(standard|basic|premium)?\s*with ads$/, '')
    .replace(/\s+(amazon|apple tv|roku premium|prime video)\s+channels?$/, '')
    .replace(/\s+plus\b/g, '+')
    .replace(/[^a-z0-9+]/g, '');
}

/** TMDB lists a service once per plan (subscription, free, with ads): keep the first of each. */
export function uniqueProviders(list: ProviderRef[]): ProviderRef[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const keys = [`id:${p.id}`, `name:${serviceKey(p.name)}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
}
