import { clientIp, cookie, fail, isCrossSite, json, readJson, tooMany, safe } from './_lib/http';
import { limit } from './_lib/limits';
import { adminStats, deleteProfile } from './_lib/profiles';
import { store } from './_lib/store';
import { safeEqual, sign, verify } from './_lib/token';

const COOKIE = 'wtw_admin';
const SESSION_SECONDS = 12 * 3600;

function isAdmin(req: Request): boolean {
  return verify<{ adm: number; e: number }>(cookie(req, COOKIE))?.adm === 1;
}

function sessionCookie(value: string, maxAge: number) {
  return `${COOKIE}=${value}; Path=/api/admin; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

/** GET /api/admin: who's using the app. Needs the admin session cookie. */
export const GET = safe(async (req: Request): Promise<Response> => {
  if (isCrossSite(req)) return fail(403, 'Requests must come from the app.');
  if (!isAdmin(req)) return fail(401, 'Sign in first.');
  try {
    return json(await adminStats(store()));
  } catch {
    return fail(503, 'Storage is unavailable right now.');
  }
});

/** POST /api/admin { action: 'login', password } | { action: 'logout' } | { action: 'delete', id } */
export const POST = safe(async (req: Request): Promise<Response> => {
  if (isCrossSite(req)) return fail(403, 'Requests must come from the app.');
  const ip = clientIp(req);
  const body = await readJson(req);
  const action = body?.['action'];

  if (action === 'login') {
    const gate = await limit('login', ip);
    if (!gate.success) return tooMany(gate.reset);
    const expected = process.env['ADMIN_PASSWORD'];
    const given = body?.['password'];
    if (!expected || expected.length < 12)
      return fail(503, 'Set an ADMIN_PASSWORD of at least 12 characters in Vercel first.');
    if (typeof given !== 'string' || !safeEqual(given, expected))
      return fail(401, 'Wrong password.');
    const token = sign({ adm: 1, e: Math.floor(Date.now() / 1000) + SESSION_SECONDS });
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_SECONDS) });
  }

  if (action === 'logout') return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });

  if (!isAdmin(req)) return fail(401, 'Sign in first.');
  if (action === 'delete') {
    const id = body?.['id'];
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return fail(400, 'Unknown profile.');
    await deleteProfile(store(), id);
    return json({ deleted: true });
  }
  return fail(400, 'Unknown action.');
});
