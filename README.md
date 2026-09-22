# Personal Tracker

Your personal cockpit for **Today → Plan this → Work on Cursor|Claude → Done**. v1 tracks **Flit** as the active project label. Managers use a secret URL (no account).

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

1. Sign in at `/login` → **Today** home (`/cockpit`).
2. **Needs triage** shows new manager todos/reviews. **Plan this** copies a `/superpowers` prompt that works in **Cursor or Claude**.
3. Paste the plan JSON back → Plan + Tasks. Set **Work on: Cursor | Claude** per task.
4. Today shows Doing / Up next / Blocked with platform chips. Optional filter: Cursor only / Claude only.
5. Copy the **manager link** (`/m/<token>`). Manager sees a **story** (in progress / waiting / done) and can add todos/reviews; edit/delete while still `new`.

### Claude / Cursor handoff API (optional)

Authenticated cookie session (same as cockpit login):

```bash
curl -X POST http://127.0.0.1:43127/api/plans \
  -H 'Content-Type: application/json' \
  -H "Cookie: pt_owner=…" \
  -d '{"inboxItemId":"…","title":"…","summary":"…","tasks":["…"]}'
```

Or send `claudeOutput` with raw plan JSON / markdown instead of structured fields.

Data is stored in local SQLite at `data/tracker.sqlite`. Uploads go to `public/uploads/`.

## Scripts

- `npm run dev` — development server on port 43127
- `npm run build` / `npm start` — production build
- `npm run test:handoff` — prompt/parse smoke test
