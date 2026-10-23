import { fail, json, methodNotAllowed, readJson, safe } from './_lib/http.js';
import { guard } from './_lib/guard.js';
import { recordEvent, type EventKind } from './_lib/profiles.js';
import { store } from './_lib/store.js';

const KINDS = new Set<EventKind>(['pull', 'seen', 'shared']);

/** POST /api/event { kind }: counts pulls, seen stubs and shares for the admin page. */
export const POST = safe(async (req: Request): Promise<Response> => {
  const g = await guard(req, 'event');
  if (g instanceof Response) return g;
  const body = await readJson(req, 256);
  const kind = body?.['kind'];
  if (typeof kind !== 'string' || !KINDS.has(kind as EventKind)) return fail(400, 'Unknown event.');
  try {
    await recordEvent(store(), kind as EventKind, g.profile?.i ?? null);
  } catch {
    // Stats only.
  }
  return json({ ok: true });
});

export const GET = () => methodNotAllowed('POST');
