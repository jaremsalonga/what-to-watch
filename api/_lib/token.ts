import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Without TOKEN_SIGNING_SECRET (local dev), tokens only survive until the instance restarts. */
const fallbackSecret = randomBytes(32).toString('hex');

export function signingSecret(): string {
  return process.env['TOKEN_SIGNING_SECRET'] || fallbackSecret;
}

function hmac(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/** Constant-time string comparison (hashes both sides so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  const key = 'compare';
  return timingSafeEqual(hmac(key, a), hmac(key, b));
}

/** A keyed hash of the IP: lets us match repeat sign-ups without storing the IP itself. */
export function hashIp(ip: string): string {
  const secret = process.env['IP_HASH_SECRET'] || signingSecret();
  return hmac(secret, ip).toString('hex').slice(0, 32);
}

export function sign(payload: object, secret = signingSecret()): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(secret, body).toString('base64url')}`;
}

/** Returns the payload when the signature is valid and `e` (expiry, epoch seconds) is in the future. */
export function verify<T extends { e: number }>(
  token: string | null,
  secret = signingSecret(),
): T | null {
  if (!token || token.length > 600) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = hmac(secret, body);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
    if (typeof payload.e !== 'number' || payload.e * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface ProfileToken {
  /** Profile id */
  i: string;
  /** Name */
  n: string;
  /** Created at, epoch ms */
  c: number;
  /** Expires, epoch seconds */
  e: number;
}

const YEAR = 365 * 24 * 3600;

export function profileToken(id: string, name: string, createdAt: number): string {
  return sign({ i: id, n: name, c: createdAt, e: Math.floor(Date.now() / 1000) + YEAR });
}

export function readProfile(req: Request): ProfileToken | null {
  const p = verify<ProfileToken>(req.headers.get('x-wtw-token'));
  return p && typeof p.i === 'string' && typeof p.n === 'string' && typeof p.c === 'number'
    ? p
    : null;
}
