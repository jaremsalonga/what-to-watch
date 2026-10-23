import { describe, expect, it } from 'vitest';
import { isCrossSite, clientIp } from '../_lib/http.js';
import { MemoryLimiter } from '../_lib/limits.js';
import {
  createOrReuse,
  recordEvent,
  sanitizeName,
  adminStats,
  deleteProfile,
} from '../_lib/profiles.js';
import { MemoryStore } from '../_lib/store.js';
import { hashIp, sign, verify, profileToken, readProfile } from '../_lib/token.js';
import { BadRequest, discoverParams } from '../_lib/validate.js';
import { caller } from '../_lib/guard.js';

const q = (s: string) => new URLSearchParams(s);
const req = (
  headers: Record<string, string> = {},
  url = 'https://whattowatch.jsalonga.dev/api/pull',
) => new Request(url, { headers });

describe('discoverParams', () => {
  it('streaming=1 limits to subscription, free or ad titles in the region', () => {
    const { params } = discoverParams(new URLSearchParams('type=movie&streaming=1&region=SG'));
    expect(params).toMatchObject({
      watch_region: 'SG',
      with_watch_monetization_types: 'flatrate|free|ads',
    });
    expect(params['with_watch_providers']).toBeUndefined();
  });

  it('maps language and origin country', () => {
    const { params } = discoverParams(q('type=tv&lang=en&country=GB'));
    expect(params).toMatchObject({ with_original_language: 'en', with_origin_country: 'GB' });
    expect(() => discoverParams(q('type=tv&country=gbr'))).toThrow(BadRequest);
  });

  it('maps the booth filters to TMDB discover parameters', () => {
    const { type, params } = discoverParams(
      q(
        'type=movie&genres=35|16&without=27,53&runtimeMax=120&from=2000-01-01&to=2019-12-31&providers=8|337&region=PH&minRating=6&page=4',
      ),
    );
    expect(type).toBe('movie');
    expect(params).toMatchObject({
      with_genres: '35|16',
      without_genres: '27,53',
      'with_runtime.lte': '120',
      'primary_release_date.gte': '2000-01-01',
      'primary_release_date.lte': '2019-12-31',
      with_watch_providers: '8|337',
      watch_region: 'PH',
      'vote_average.gte': '6',
      page: '4',
      include_adult: 'false',
    });
  });

  it('uses first_air_date for series and release_date for in-cinemas', () => {
    expect(discoverParams(q('type=tv&from=2010-01-01')).params['first_air_date.gte']).toBe(
      '2010-01-01',
    );
    const cinema = discoverParams(
      q('type=movie&releaseTypes=3|2&from=2026-09-01&region=PH'),
    ).params;
    expect(cinema).toMatchObject({
      with_release_type: '3|2',
      'release_date.gte': '2026-09-01',
      region: 'PH',
    });
  });

  it('clamps numbers and drops unknown keys', () => {
    const { params } = discoverParams(
      q('type=movie&page=999&runtimeMax=9000&api_key=x&with_cast=1'),
    );
    expect(params['page']).toBe('20');
    expect(params['with_runtime.lte']).toBe('400');
    expect(params).not.toHaveProperty('api_key');
    expect(params).not.toHaveProperty('with_cast');
  });

  it.each([
    'type=person',
    'type=movie&genres=28;drop',
    'type=movie&from=2020-13-01',
    'type=movie&providers=8&region=ph',
    'type=movie&page=-1',
    'type=movie&sort=title.asc',
  ])('rejects %s', (s) => {
    expect(() => discoverParams(q(s))).toThrow(BadRequest);
  });
});

describe('tokens', () => {
  it('round-trips and rejects tampering or expiry', () => {
    const t = sign({ a: 1, e: Math.floor(Date.now() / 1000) + 60 }, 'secret');
    expect(verify<{ a: number; e: number }>(t, 'secret')?.a).toBe(1);
    expect(verify(t, 'other')).toBeNull();
    expect(verify(t.replace(/^./, 'x'), 'secret')).toBeNull();
    expect(verify(sign({ e: 1 }, 'secret'), 'secret')).toBeNull();
  });

  it('reads a profile token from the request header', () => {
    const token = profileToken('id-1', 'Jarem', 123);
    expect(readProfile(req({ 'x-wtw-token': token }))).toMatchObject({
      i: 'id-1',
      n: 'Jarem',
      c: 123,
    });
    expect(readProfile(req({ 'x-wtw-token': 'nope' }))).toBeNull();
  });

  it('hashes IPs consistently without exposing them', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4');
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'));
  });
});

describe('request checks', () => {
  it('builds the name-createdAt-ip limit key', () => {
    const token = profileToken('id', 'Mark Anthony', 1761218400000);
    expect(caller(req({ 'x-wtw-token': token, 'x-real-ip': '9.9.9.9' })).key).toBe(
      'mark_anthony-1761218400000-9.9.9.9',
    );
    expect(caller(req({ 'x-forwarded-for': '8.8.8.8, 10.0.0.1' })).key).toBe('anon-0-8.8.8.8');
  });

  it('flags cross-site requests', () => {
    expect(isCrossSite(req({ 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(
      isCrossSite(req({ origin: 'https://evil.example', host: 'whattowatch.jsalonga.dev' })),
    ).toBe(true);
    expect(
      isCrossSite(
        req({ origin: 'https://whattowatch.jsalonga.dev', host: 'whattowatch.jsalonga.dev' }),
      ),
    ).toBe(false);
    expect(isCrossSite(req({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
  });

  it('prefers x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1');
  });
});

describe('MemoryLimiter', () => {
  it('allows 3 per second per profile key, then blocks until the window passes', () => {
    let t = 1_000_000;
    const l = new MemoryLimiter(() => t);
    expect([1, 2, 3].map(() => l.limit('profile', 'k').success)).toEqual([true, true, true]);
    const blocked = l.limit('profile', 'k');
    expect(blocked.success).toBe(false);
    expect(blocked.reset).toBe(1_001_000);
    expect(l.limit('profile', 'other').success).toBe(true);
    t += 1001;
    expect(l.limit('profile', 'k').success).toBe(true);
  });
});

describe('profiles', () => {
  const allow = async () => ({ success: true, reset: 0 });

  it('cleans names', () => {
    expect(sanitizeName('  Jarem\u0000  S. \n')).toBe('Jarem S.');
    expect(sanitizeName('x'.repeat(40))).toHaveLength(20);
    expect(sanitizeName('<b>hi</b>')).toBe('<b>hi</b>'); // shown as text, never HTML
    expect(sanitizeName(42)).toBe('');
  });

  it('gives the same profile back for the same name and IP, but allows duplicate names elsewhere', async () => {
    const db = new MemoryStore();
    const a = await createOrReuse(db, 'Mark', 'ipA', allow);
    const again = await createOrReuse(db, 'mark', 'ipA', allow);
    const otherIp = await createOrReuse(db, 'Mark', 'ipB', allow);
    expect(a.ok && again.ok && otherIp.ok).toBe(true);
    if (a.ok && again.ok && otherIp.ok) {
      expect(again.reused).toBe(true);
      expect(again.profile.id).toBe(a.profile.id);
      expect(otherIp.profile.id).not.toBe(a.profile.id);
    }
    expect(await db.zcard('profiles')).toBe(2);
  });

  it('refuses new profiles when the per-IP creation limit is hit', async () => {
    const db = new MemoryStore();
    const r = await createOrReuse(db, 'Ali', 'ipA', async () => ({ success: false, reset: 99 }));
    expect(r).toEqual({ ok: false, reason: 'limited', reset: 99 });
  });

  it('counts events, writes last seen at most hourly, and reports stats', async () => {
    const db = new MemoryStore();
    const created = await createOrReuse(db, 'Kai', 'ip', allow, 1000);
    if (!created.ok) throw new Error();
    const id = created.profile.id;
    await recordEvent(db, 'pull', id, 5000);
    await recordEvent(db, 'pull', id, 6000);
    await recordEvent(db, 'seen', null, 6000);
    const p = await db.hgetall(`profile:${id}`);
    expect(p?.['pulls']).toBe('2');
    expect(p?.['lastSeen']).toBe('5000');
    const stats = await adminStats(db, 6000);
    expect(stats.totals.profiles).toBe(1);
    expect(stats.profiles[0]).toMatchObject({ name: 'Kai', pulls: 2 });
    await deleteProfile(db, id);
    expect((await adminStats(db, 6000)).profiles).toHaveLength(0);
  });
});
