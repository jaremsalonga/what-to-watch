import { Redis } from '@upstash/redis';

/**
 * The few Redis commands the app uses. Upstash in production; an in-memory version when
 * no database is connected (local dev, or a fresh deploy before Upstash is added).
 */
export interface Store {
  readonly persistent: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  incr(key: string, by?: number, ttlSeconds?: number): Promise<number>;
  hset(key: string, values: Record<string, string | number>): Promise<void>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  hincr(key: string, field: string, by?: number): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, member: string): Promise<void>;
  zcount(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  /** Members by score, highest first. */
  zrevrange(key: string, count: number): Promise<string[]>;
  mget(keys: string[]): Promise<(string | null)[]>;
}

export function redisFromEnv(): Redis | null {
  const url = process.env['KV_REST_API_URL'] || process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['KV_REST_API_TOKEN'] || process.env['UPSTASH_REDIS_REST_TOKEN'];
  return url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;
}

class UpstashStore implements Store {
  readonly persistent = true;
  constructor(private r: Redis) {}
  async get(key: string) {
    const v = await this.r.get<string>(key);
    return v == null ? null : String(v);
  }
  async set(key: string, value: string, opts: { ex?: number; nx?: boolean } = {}) {
    const res =
      opts.ex && opts.nx
        ? await this.r.set(key, value, { ex: opts.ex, nx: true })
        : opts.ex
          ? await this.r.set(key, value, { ex: opts.ex })
          : opts.nx
            ? await this.r.set(key, value, { nx: true })
            : await this.r.set(key, value);
    return res === 'OK';
  }
  async del(...keys: string[]) {
    if (keys.length) await this.r.del(...keys);
  }
  async incr(key: string, by = 1, ttlSeconds?: number) {
    const p = this.r.pipeline().incrby(key, by);
    if (ttlSeconds) p.expire(key, ttlSeconds);
    const [n] = await p.exec<[number, ...unknown[]]>();
    return Number(n);
  }
  async hset(key: string, values: Record<string, string | number>) {
    await this.r.hset(key, values);
  }
  async hgetall(key: string) {
    const v = await this.r.hgetall<Record<string, string>>(key);
    return v && Object.keys(v).length ? v : null;
  }
  async hincr(key: string, field: string, by = 1) {
    await this.r.hincrby(key, field, by);
  }
  async zadd(key: string, score: number, member: string) {
    await this.r.zadd(key, { score, member });
  }
  async zrem(key: string, member: string) {
    await this.r.zrem(key, member);
  }
  async zcount(key: string, min: number, max: number) {
    return this.r.zcount(key, min, max);
  }
  async zcard(key: string) {
    return this.r.zcard(key);
  }
  async zrevrange(key: string, count: number) {
    return (await this.r.zrange<string[]>(key, 0, count - 1, { rev: true })).map(String);
  }
  async mget(keys: string[]) {
    if (!keys.length) return [];
    return (await this.r.mget<(string | null)[]>(...keys)).map((v) =>
      v == null ? null : String(v),
    );
  }
}

export class MemoryStore implements Store {
  readonly persistent = false;
  private kv = new Map<string, { v: string; exp: number }>();
  private h = new Map<string, Record<string, string>>();
  private z = new Map<string, Map<string, number>>();

  private alive(key: string) {
    const e = this.kv.get(key);
    if (e && e.exp && e.exp < Date.now()) this.kv.delete(key);
    return this.kv.get(key);
  }
  async get(key: string) {
    return this.alive(key)?.v ?? null;
  }
  async set(key: string, value: string, opts: { ex?: number; nx?: boolean } = {}) {
    if (opts.nx && this.alive(key)) return false;
    this.kv.set(key, { v: value, exp: opts.ex ? Date.now() + opts.ex * 1000 : 0 });
    return true;
  }
  async del(...keys: string[]) {
    for (const k of keys) {
      this.kv.delete(k);
      this.h.delete(k);
      this.z.delete(k);
    }
  }
  async incr(key: string, by = 1, ttlSeconds?: number) {
    const n = Number(this.alive(key)?.v ?? 0) + by;
    this.kv.set(key, { v: String(n), exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
    return n;
  }
  async hset(key: string, values: Record<string, string | number>) {
    const cur = this.h.get(key) ?? {};
    for (const [k, v] of Object.entries(values)) cur[k] = String(v);
    this.h.set(key, cur);
  }
  async hgetall(key: string) {
    const v = this.h.get(key);
    return v ? { ...v } : null;
  }
  async hincr(key: string, field: string, by = 1) {
    const cur = this.h.get(key) ?? {};
    cur[field] = String(Number(cur[field] ?? 0) + by);
    this.h.set(key, cur);
  }
  private zset(key: string) {
    let s = this.z.get(key);
    if (!s) this.z.set(key, (s = new Map()));
    return s;
  }
  async zadd(key: string, score: number, member: string) {
    this.zset(key).set(member, score);
  }
  async zrem(key: string, member: string) {
    this.zset(key).delete(member);
  }
  async zcount(key: string, min: number, max: number) {
    return [...this.zset(key).values()].filter((s) => s >= min && s <= max).length;
  }
  async zcard(key: string) {
    return this.zset(key).size;
  }
  async zrevrange(key: string, count: number) {
    return [...this.zset(key).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([m]) => m);
  }
  async mget(keys: string[]) {
    return keys.map((k) => this.alive(k)?.v ?? null);
  }
}

let cached: Store | null = null;

export function store(): Store {
  if (!cached) {
    const r = redisFromEnv();
    cached = r ? new UpstashStore(r) : new MemoryStore();
  }
  return cached;
}
