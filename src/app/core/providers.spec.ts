import { serviceKey, uniqueProviders } from './providers';

const p = (id: number, name: string) => ({ id, name, logo: null });

describe('uniqueProviders', () => {
  it('drops the same service listed twice or under another plan', () => {
    const list = [
      p(8, 'Netflix'),
      p(1796, 'Netflix basic with Ads'),
      p(119, 'Amazon Prime Video'),
      p(8, 'Netflix'),
      p(2100, 'Amazon Prime Video with Ads'),
      p(350, 'Apple TV+'),
    ];
    expect(uniqueProviders(list).map((x) => x.name)).toEqual([
      'Netflix',
      'Amazon Prime Video',
      'Apple TV+',
    ]);
  });

  it('treats store channels and "Plus" spellings as the same service', () => {
    expect(serviceKey('Paramount Plus Apple TV Channel')).toBe(serviceKey('Paramount+'));
    expect(serviceKey('HBO Max Amazon Channel')).toBe(serviceKey('HBO Max'));
    expect(serviceKey('Disney Plus')).toBe(serviceKey('Disney+'));
  });

  it('keeps different services apart', () => {
    expect(serviceKey('Apple TV')).not.toBe(serviceKey('Apple TV+'));
    expect(uniqueProviders([p(337, 'Disney Plus'), p(384, 'HBO Max')])).toHaveLength(2);
  });
});
