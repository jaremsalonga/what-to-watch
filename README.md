# What to Watch?

A ticket-booth movie picker PWA. Set a mood and how much time you have, roll the film strip, and the booth prints a ticket for something you can stream tonight. Live at **https://whattowatch.jsalonga.dev**.

Sibling of [What to Eat?](https://whattoeat.jsalonga.dev). Angular 21 (standalone, signals, zoneless), Vercel Functions for the API, TMDB for movie data, Upstash Redis for names and rate limits. Runs on free plans.

## How it fits together

```
Browser (Angular PWA)  ->  /api/* (Vercel Functions)  ->  TMDB
                                  |
                                  +-> Upstash Redis (names, counters, rate limits)
```

- The TMDB token only lives on the server. The browser calls `/api/pull`, `/api/title` and `/api/meta`, which accept an allowlist of parameters, clamp numbers, and are cached at Vercel's edge (12 to 24 hours, lists for a week).
- `/api/profile` saves "What should we call you?" as `profile:{id} = { name, createdAt, ipHash }` (random id, so duplicate names are fine) and returns a signed token.
- Filters, services, seen and saved-for-later lists stay on the device (`localStorage` key `wtw:v1`).

## Setting up Vercel (one time)

1. Import this repo in Vercel. Framework: Angular (from `vercel.json`).
2. **Storage:** Marketplace -> Upstash -> Redis, free plan, connect to this project. That adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Environment variables** (Settings -> Environment Variables, Production and Preview, mark them Sensitive):

   | Name                   | What                                                                                                  |
   | ---------------------- | ----------------------------------------------------------------------------------------------------- |
   | `TMDB_READ_TOKEN`      | TMDB "API Read Access Token" (themoviedb.org -> Settings -> API). `TMDB_API_KEY` (v3 key) also works. |
   | `TOKEN_SIGNING_SECRET` | Long random string, e.g. `openssl rand -hex 32`. Signs name tokens and admin sessions.                |
   | `IP_HASH_SECRET`       | Another long random string. Keys the IP hash so raw IPs are never stored.                             |
   | `ADMIN_PASSWORD`       | 12+ characters. Opens `/admin`.                                                                       |

4. **Domain:** add `whattowatch.jsalonga.dev` under Settings -> Domains and create the CNAME it asks for.
5. Optional: Settings -> Firewall. Keep "Attack Challenge Mode" in mind for emergencies; add custom rules to block abusive IPs.

Without Upstash the app still works, but names and limits only live in each server instance's memory. Without a TMDB token the API answers "Movie data is not configured yet."

## Limits and protection

| Limit                        | Key                                                                   |
| ---------------------------- | --------------------------------------------------------------------- |
| 3 requests/second            | `name-createdAt-ip` (anonymous visitors: `anon-0-ip`)                 |
| 10 requests/second           | IP (ceiling, so new names don't get more)                             |
| 1 new name / 10 min, 5 / day | IP hash; same name + same IP within 24 h returns the existing profile |
| 5 admin sign-ins / 15 min    | IP                                                                    |

Blocked callers are remembered in memory so repeat hits don't use Redis commands. If Redis is down or over quota, a per-instance limiter takes over. Security headers (CSP, HSTS, no framing) are in `vercel.json`. Vercel's network handles volumetric DDoS.

## Develop

```bash
npm install
npm run build          # Angular build
npm test               # Angular unit tests (Vitest)
npm run test:api       # API tests (Vitest, no network)
npm run typecheck:api
```

`ng serve` runs the front end only. For the API locally, use `vercel dev` with a `.env.local` (see `.env.example`, or `vercel env pull`).

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by JustWatch.
