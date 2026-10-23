import { clientIp, fail, isCrossSite, tooMany } from './http';
import { limitAll, takeBlockedCount } from './limits';
import { dayKey } from './profiles';
import { store } from './store';
import { readProfile, type ProfileToken } from './token';

export interface Caller {
  ip: string;
  profile: ProfileToken | null;
  /** name-createdAt-ip, or anon-0-ip without a profile */
  key: string;
}

export function caller(req: Request): Caller {
  const ip = clientIp(req);
  const profile = readProfile(req);
  const name = profile ? profile.n.toLowerCase().replace(/\s+/g, '_') : 'anon';
  return { ip, profile, key: `${name}-${profile?.c ?? 0}-${ip}` };
}

/**
 * Same-site check plus the two request limits: 3/s per name-createdAt-ip, 10/s per IP.
 * Returns a ready error response, or the caller when the request may go ahead.
 */
export async function guard(
  req: Request,
  rule: 'profile' | 'event' = 'profile',
): Promise<Response | Caller> {
  if (isCrossSite(req)) return fail(403, 'Requests must come from the app.');
  const c = caller(req);
  const blocked = await limitAll([
    ['ip', c.ip],
    [rule, c.key],
  ]);
  if (blocked) {
    await flushBlocked();
    return tooMany(blocked.reset);
  }
  return c;
}

let lastFlush = 0;

/** Adds this instance's blocked-request count to today's total, at most once a minute. */
export async function flushBlocked(now = Date.now()) {
  if (now - lastFlush < 60_000) return;
  const n = takeBlockedCount();
  lastFlush = now;
  if (!n) return;
  try {
    await store().incr(`blocked:${dayKey(now)}`, n, 40 * 86_400);
  } catch {
    // Stats only; never fail a request over them.
  }
}
