import { randomUUID } from 'node:crypto';
import type { Store } from './store';

const DAY = 86_400;

/** Trims to 20 characters, drops control and formatting characters, collapses spaces. */
export function sanitizeName(input: unknown): string {
  if (typeof input !== 'string') return '';
  const clean = input
    .normalize('NFC')
    .replace(/[\p{C}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...clean].slice(0, 20).join('').trim();
}

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
}

export type CreateResult =
  { ok: true; profile: Profile; reused: boolean } | { ok: false; reason: 'limited'; reset: number };

/**
 * Profiles are keyed by a random id, so duplicate names are fine. The same name from the same
 * IP within 24 hours gets the existing profile back instead of a new one; otherwise new
 * profiles per IP are limited by `allowCreate` (1 per 10 minutes, 5 per day).
 */
export async function createOrReuse(
  db: Store,
  name: string,
  ipHash: string,
  allowCreate: () => Promise<{ success: boolean; reset: number }>,
  now = Date.now(),
): Promise<CreateResult> {
  const reuseKey = `reuse:${ipHash}:${name.toLowerCase()}`;
  const existingId = await db.get(reuseKey);
  if (existingId) {
    const p = await db.hgetall(`profile:${existingId}`);
    if (p) {
      return {
        ok: true,
        reused: true,
        profile: { id: existingId, name: p['name'], createdAt: Number(p['createdAt']) },
      };
    }
  }
  const gate = await allowCreate();
  if (!gate.success) return { ok: false, reason: 'limited', reset: gate.reset };

  const profile: Profile = { id: randomUUID(), name, createdAt: now };
  await db.hset(`profile:${profile.id}`, {
    name,
    createdAt: now,
    ipHash,
    lastSeen: now,
    pulls: 0,
    seen: 0,
    shared: 0,
  });
  await db.zadd('profiles', now, profile.id);
  await db.zadd('active', now, profile.id);
  await db.set(reuseKey, profile.id, { ex: DAY });
  return { ok: true, reused: false, profile };
}

export async function deleteProfile(db: Store, id: string): Promise<void> {
  await db.del(`profile:${id}`, `ls:${id}`);
  await db.zrem('profiles', id);
  await db.zrem('active', id);
}

export type EventKind = 'pull' | 'seen' | 'shared';
const FIELD: Record<EventKind, string> = { pull: 'pulls', seen: 'seen', shared: 'shared' };

export function dayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Bumps counters. "Last seen" is written at most once an hour per person to save commands. */
export async function recordEvent(
  db: Store,
  kind: EventKind,
  profileId: string | null,
  now = Date.now(),
) {
  if (kind === 'pull') await db.incr(`pulls:${dayKey(now)}`, 1, 40 * DAY);
  if (!profileId) return;
  const key = `profile:${profileId}`;
  if (!(await db.hgetall(key))) return;
  await db.hincr(key, FIELD[kind]);
  if (await db.set(`ls:${profileId}`, '1', { ex: 3600, nx: true })) {
    await db.hset(key, { lastSeen: now });
    await db.zadd('active', now, profileId);
  }
}

export async function adminStats(db: Store, now = Date.now()) {
  const week = now - 7 * DAY * 1000;
  const days = Array.from({ length: 7 }, (_, i) => dayKey(now - (6 - i) * DAY * 1000));
  const [profiles, activeWeek, newWeek, pullCounts, blockedCounts] = await Promise.all([
    db.zcard('profiles'),
    db.zcount('active', week, Infinity),
    db.zcount('profiles', week, Infinity),
    db.mget(days.map((d) => `pulls:${d}`)),
    db.mget(days.map((d) => `blocked:${d}`)),
  ]);
  const ids = await db.zrevrange('active', 200);
  const rows = (
    await Promise.all(
      ids.map(async (id) => {
        const p = await db.hgetall(`profile:${id}`);
        return p
          ? {
              id,
              name: p['name'],
              createdAt: Number(p['createdAt']),
              lastSeen: Number(p['lastSeen']),
              pulls: Number(p['pulls'] ?? 0),
              seen: Number(p['seen'] ?? 0),
              shared: Number(p['shared'] ?? 0),
            }
          : null;
      }),
    )
  ).filter((r) => r !== null);
  return {
    persistent: db.persistent,
    totals: { profiles, activeWeek, newWeek, pullsToday: Number(pullCounts[6] ?? 0) },
    days: days.map((d, i) => ({
      day: d,
      pulls: Number(pullCounts[i] ?? 0),
      blocked: Number(blockedCounts[i] ?? 0),
    })),
    profiles: rows,
  };
}
