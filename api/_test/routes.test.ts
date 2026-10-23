import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const base = 'https://whattowatch.jsalonga.dev';
const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(base + path, {
    headers: { 'x-real-ip': '5.5.5.5', 'sec-fetch-site': 'same-origin', ...headers },
  });

describe('API routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('pull: calls TMDB discover with the server token and returns slim, cacheable results', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        page: 2,
        total_pages: 40,
        total_results: 800,
        results: [
          {
            id: 129,
            title: 'Spirited Away',
            overview: 'A girl...',
            poster_path: '/p.jpg',
            release_date: '2001-07-20',
            vote_average: 8.54,
            vote_count: 17000,
            genre_ids: [16, 10751],
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('../pull');
    const res = await GET(get('/api/pull?type=movie&genres=16&page=2'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      id: 129,
      title: 'Spirited Away',
      year: 2001,
      rating: 8.5,
      poster: '/p.jpg',
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain('/discover/movie');
    expect(String(url)).toContain('with_genres=16');
    expect(String(url)).not.toContain('test-token');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer test-token');
  });

  it('pull: rejects bad input and cross-site callers before calling TMDB', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('../pull');
    expect((await GET(get('/api/pull?type=person'))).status).toBe(400);
    expect(
      (await GET(get('/api/pull?type=movie', { 'sec-fetch-site': 'cross-site' }))).status,
    ).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pull: limits each visitor to 3 requests per second', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ page: 1, total_pages: 1, total_results: 0, results: [] })),
    );
    const { GET } = await import('../pull');
    const statuses = [];
    for (let i = 0; i < 4; i++)
      statuses.push((await GET(get('/api/pull?type=movie', { 'x-real-ip': '7.7.7.7' }))).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it('pull: says so when TMDB is not configured', async () => {
    vi.stubEnv('TMDB_READ_TOKEN', '');
    vi.stubEnv('TMDB_API_KEY', '');
    const { GET } = await import('../pull');
    expect((await GET(get('/api/pull?type=movie'))).status).toBe(503);
  });

  it('profile: creates a profile, returns the same one on retry, and limits new names per IP', async () => {
    const { POST } = await import('../profile');
    const post = (name: string) =>
      POST(
        new Request(base + '/api/profile', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-real-ip': '6.6.6.6',
            origin: base,
            host: 'whattowatch.jsalonga.dev',
          },
          body: JSON.stringify({ name }),
        }),
      );
    const first = await (await post('Jarem')).json();
    expect(first.token).toBeTruthy();
    const again = await (await post('Jarem')).json();
    expect(again.id).toBe(first.id);
    expect(again.reused).toBe(true);
    expect((await post('Someone Else')).status).toBe(429);
    expect((await post('')).status).toBe(400);
  });

  it('admin: refuses without a session and with a wrong password', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'correct horse battery');
    const { GET, POST } = await import('../admin');
    expect((await GET(get('/api/admin'))).status).toBe(401);
    const login = (password: string) =>
      POST(
        new Request(base + '/api/admin', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-real-ip': '4.4.4.4',
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ action: 'login', password }),
        }),
      );
    expect((await login('wrong')).status).toBe(401);
    const ok = await login('correct horse battery');
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const stats = await GET(get('/api/admin', { cookie: cookie.split(';')[0] }));
    expect(stats.status).toBe(200);
    expect((await stats.json()).totals).toBeDefined();
  });
});
