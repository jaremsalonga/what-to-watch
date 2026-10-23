import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { redisFromEnv } from './store.js';

export type Rule = 'profile' | 'ip' | 'createShort' | 'createDay' | 'login' | 'event';

/** Limits from the design proposal. `profile` is keyed by name-createdAt-ip, the rest by IP or IP hash. */
export const RULES: Record<Rule, { tokens: number; window: Duration; ms: number }> = {
  profile: { tokens: 3, window: '1 s', ms: 1000 },
  ip: { tokens: 10, window: '1 s', ms: 1000 },
  createShort: { tokens: 1, window: '10 m', ms: 600_000 },
  createDay: { tokens: 5, window: '1 d', ms: 86_400_000 },
  login: { tokens: 5, window: '15 m', ms: 900_000 },
  event: { tokens: 5, window: '1 s', ms: 1000 },
};

export interface LimitResult {
  success: boolean;
  /** When the window resets, epoch ms */
  reset: number;
}

/** Sliding-window log kept in this instance's memory. Used when Redis isn't connected or is down. */
export class MemoryLimiter {
  private hits = new Map<string, number[]>();
  constructor(private now = () => Date.now()) {}

  limit(rule: Rule, key: string): LimitResult {
    const { tokens, ms } = RULES[rule];
    const t = this.now();
    const id = `${rule}:${key}`;
    const recent = (this.hits.get(id) ?? []).filter((x) => x > t - ms);
    if (recent.length >= tokens) {
      this.hits.set(id, recent);
      return { success: false, reset: recent[0] + ms };
    }
    recent.push(t);
    this.hits.set(id, recent);
    if (this.hits.size > 5000) this.sweep(t);
    return { success: true, reset: t + ms };
  }

  private sweep(t: number) {
    for (const [id, list] of this.hits)
      if (!list.some((x) => x > t - 86_400_000)) this.hits.delete(id);
  }
}

const memory = new MemoryLimiter();
let upstash: Partial<Record<Rule, Ratelimit>> | null | undefined;
/** Blocks counted here are flushed to Redis at most once a minute (see flushBlocked). */
let blockedSinceFlush = 0;

function upstashLimiters() {
  if (upstash === undefined) {
    const redis = redisFromEnv();
    upstash = redis ? {} : null;
    if (redis) {
      for (const [rule, cfg] of Object.entries(RULES) as [Rule, (typeof RULES)[Rule]][]) {
        upstash![rule] = new Ratelimit({
          redis,
          prefix: `rl:${rule}`,
          limiter: Ratelimit.slidingWindow(cfg.tokens, cfg.window),
          // Once someone is blocked, repeat hits are refused in memory without touching Redis,
          // so a flood can't burn through the free-tier command quota.
          ephemeralCache: new Map(),
          timeout: 1000,
        });
      }
    }
  }
  return upstash;
}

export async function limit(rule: Rule, key: string): Promise<LimitResult> {
  let result: LimitResult;
  const l = upstashLimiters()?.[rule];
  if (!l) {
    result = memory.limit(rule, key);
  } else {
    try {
      const r = await l.limit(key);
      result = { success: r.success, reset: r.reset };
    } catch {
      // Redis down or over its free quota: keep protecting with the per-instance limiter.
      result = memory.limit(rule, key);
    }
  }
  if (!result.success) blockedSinceFlush++;
  return result;
}

/** Checks several limits in order and returns the first refusal, if any. */
export async function limitAll(checks: [Rule, string][]): Promise<LimitResult | null> {
  for (const [rule, key] of checks) {
    const r = await limit(rule, key);
    if (!r.success) return r;
  }
  return null;
}

export function takeBlockedCount(): number {
  const n = blockedSinceFlush;
  blockedSinceFlush = 0;
  return n;
}
