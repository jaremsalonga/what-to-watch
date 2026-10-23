import { detectRegion } from './region';

describe('detectRegion', () => {
  it('uses the time zone first', () => {
    expect(detectRegion('Asia/Manila', ['en-US'])).toBe('PH');
    expect(detectRegion('Europe/London', [])).toBe('GB');
  });
  it('falls back to the locale, then the Philippines', () => {
    expect(detectRegion('Asia/Yerevan', ['hy-AM'])).toBe('AM');
    expect(detectRegion(undefined, [])).toBe('PH');
  });
  it('treats unknown American zones as the US', () => {
    expect(detectRegion('America/Chicago', ['en-US'])).toBe('US');
  });
});
