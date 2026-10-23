import { buildQuery, releaseRange } from './query';
import { DEFAULT_FILTERS, type Filters } from './types';

const today = new Date('2026-10-23T12:00:00Z');
const ctx = { region: 'PH', services: [8, 337], showAll: false, today, random: () => 0.1 };
const f = (patch: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...patch });

describe('buildQuery', () => {
  it('uses the mood genres, runtime and my services', () => {
    const q = buildQuery(f({ mood: 'feel-good', time: 'medium' }), ctx);
    expect(q.type).toBe('movie');
    expect(q.params).toMatchObject({
      genres: '35|10751|16|10402',
      without: '27,10752,53',
      runtimeMax: '120',
      providers: '8|337',
      region: 'PH',
      to: '2026-10-23',
      minVotes: '100',
    });
  });

  it('lets picked genres replace the mood genres, and never excludes a picked genre', () => {
    const q = buildQuery(f({ mood: 'feel-good', genres: [27, 18], match: 'all' }), ctx);
    expect(q.params['genres']).toBe('27,18');
    expect(q.params['without']).toBe('10752,53');
  });

  it('maps movie genres to series genres', () => {
    const q = buildQuery(f({ type: 'tv', genres: [28, 878, 27] }), ctx);
    expect(q.params['genres']).toBe('10759|10765');
  });

  it('Surprise me ignores genres and asks for highly rated, little-known titles', () => {
    const q = buildQuery(f({ mood: 'surprise', genres: [28] }), ctx);
    expect(q.surprise).toBe(true);
    expect(q.params['genres']).toBeUndefined();
    expect(q.params).toMatchObject({ minRating: '7.3', minVotes: '150', maxVotes: '2000' });
  });

  it('In cinemas now forces movies, uses theatrical releases and skips services', () => {
    const q = buildQuery(f({ type: 'tv', release: ['cinemas'] }), ctx);
    expect(q.type).toBe('movie');
    expect(q.cinemas).toBe(true);
    expect(q.params).toMatchObject({
      releaseTypes: '3|2',
      from: '2026-09-08',
      to: '2026-10-30',
      region: 'PH',
    });
    expect(q.params['providers']).toBeUndefined();
  });

  it('a custom year range overrides presets and stops at today', () => {
    const q = buildQuery(f({ years: { from: 2015, to: 2026 }, release: ['90s'] }), ctx);
    expect(q.params).toMatchObject({ from: '2015-01-01', to: '2026-10-23' });
  });

  it('Any service keeps titles streaming somewhere in the region', () => {
    const q = buildQuery(f(), { ...ctx, showAll: true });
    expect(q.params['providers']).toBeUndefined();
    expect(q.params).toMatchObject({ streaming: '1', region: 'PH' });
    expect(buildQuery(f(), { ...ctx, services: [] }).params['streaming']).toBe('1');
  });

  it('Anywhere drops every availability filter', () => {
    const q = buildQuery(f({ streamOnly: false }), { ...ctx, showAll: true });
    expect(q.params['providers']).toBeUndefined();
    expect(q.params['streaming']).toBeUndefined();
  });

  it('gives identical filters the same cache key', () => {
    expect(buildQuery(f({ mood: 'funny' }), ctx).key).toBe(
      buildQuery(f({ mood: 'funny' }), ctx).key,
    );
  });
});

describe('releaseRange', () => {
  it('covers the decades', () => {
    expect(releaseRange('90s', today)).toEqual({ from: '1990-01-01', to: '1999-12-31' });
    expect(releaseRange('last-5', today)).toEqual({ from: '2021-10-23', to: '2026-10-23' });
  });
});
