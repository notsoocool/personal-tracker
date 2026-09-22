# Personal Tracker

Your personal cockpit for inbox → plan → tasks. v1 tracks **Flit** as the active project label. Managers use a secret URL (no account).

## Run locally

```bash
npm install
npm run dev
```

Dev server defaults to **http://127.0.0.1:43127**.

Owner password (default): `tracker-dev`

Optional env (create `.env.local`):

```bash
OWNER_PASSWORD=tracker-dev
SESSION_SECRET=change-me
```

## How it works

1. Sign in at `/login` → owner **cockpit** (`/cockpit`).
2. **Ready** tab is the day queue: Doing / Ready next / Blocked.
3. Copy the **manager link** from the cockpit header (`/m/<token>`).
4. Manager adds todos / reviews (notes + page URL; optional screenshot). They can **edit or delete** items while still `new`.
5. Owner uses **Plan with Claude** (copies a /superpowers-ready prompt), then **Promote / paste plan** to accept Claude’s JSON into Plan + Tasks.
6. Task status changes show on the same manager link with per-plan status breakdown.

### Claude handoff API (optional)

Authenticated cookie session (same as cockpit login):

```bash
curl -X POST http://127.0.0.1:43127/api/plans \
  -H 'Content-Type: application/json' \
  -H "Cookie: pt_owner=…" \
  -d '{"inboxItemId":"…","title":"…","summary":"…","tasks":["…"]}'
```

Or send `claudeOutput` with raw Claude JSON / markdown instead of structured fields.

Data is stored in local SQLite at `data/tracker.sqlite`. Uploads go to `public/uploads/`.

## Scripts

- `npm run dev` — development server on port 43127
- `npm run build` / `npm start` — production build
- `npm run test:handoff` — Claude prompt/parse smoke test
