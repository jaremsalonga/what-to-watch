import { clientIp, fail, isCrossSite, json, readJson, tooMany, safe } from './_lib/http.js';
import { limit, limitAll } from './_lib/limits.js';
import { createOrReuse, deleteProfile, sanitizeName } from './_lib/profiles.js';
import { store } from './_lib/store.js';
import { hashIp, profileToken, readProfile } from './_lib/token.js';

/** POST /api/profile { name }: "What should we call you?". Returns a signed token. */
export const POST = safe(async (req: Request): Promise<Response> => {
  if (isCrossSite(req)) return fail(403, 'Requests must come from the app.');
  const ip = clientIp(req);
  const ipCheck = await limit('ip', ip);
  if (!ipCheck.success) return tooMany(ipCheck.reset);

  const body = await readJson(req);
  const name = sanitizeName(body?.['name']);
  if (!name) return fail(400, 'Enter a name between 1 and 20 characters.');

  const ipHash = hashIp(ip);
  try {
    const result = await createOrReuse(store(), name, ipHash, async () => {
      const blocked = await limitAll([
        ['createShort', ipHash],
        ['createDay', ipHash],
      ]);
      return blocked ? { success: false, reset: blocked.reset } : { success: true, reset: 0 };
    });
    if (!result.ok) return tooMany(result.reset);
    const { id, name: saved, createdAt } = result.profile;
    return json({
      id,
      name: saved,
      createdAt,
      reused: result.reused,
      token: profileToken(id, saved, createdAt),
    });
  } catch {
    return fail(503, 'Could not save your name right now. You can keep using the app.');
  }
});

/** DELETE /api/profile: "Delete my name". */
export const DELETE = safe(async (req: Request): Promise<Response> => {
  if (isCrossSite(req)) return fail(403, 'Requests must come from the app.');
  const ipCheck = await limit('ip', clientIp(req));
  if (!ipCheck.success) return tooMany(ipCheck.reset);
  const p = readProfile(req);
  if (!p) return fail(401, 'No saved name to delete.');
  try {
    await deleteProfile(store(), p.i);
    return json({ deleted: true });
  } catch {
    return fail(503, 'Could not delete right now. Try again later.');
  }
});
