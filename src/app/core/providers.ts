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
export function uniqueProviders<T extends ProviderRef>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const keys = [`id:${p.id}`, `name:${serviceKey(p.name)}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
}

/**
 * Stores that only rent or sell films. TMDB lists them next to the subscriptions, so "Amazon
 * Video" sat beside "Amazon Prime Video" in the services picker like a second Prime.
 */
const STORES = new Set([2, 3, 7, 10, 68, 192]);

/** The services picker's list: subscriptions only, each service once, Netflix Kids under Netflix. */
export function subscriptionServices<T extends ProviderRef>(list: T[]): T[] {
  const subs = list.filter((p) => !STORES.has(p.id) && !/\bstore$/i.test(p.name.trim()));
  const keyed = (p: T) => serviceKey(p.name.replace(/\s+kids$/i, ''));
  const seen = new Set<string>();
  return uniqueProviders(subs).filter((p) => {
    const k = keyed(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Big services TMDB has no data for in some countries, so they can't go in the picker there. */
export const WELL_KNOWN = [{ id: 337, name: 'Disney+' }];
