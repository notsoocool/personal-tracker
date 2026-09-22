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
2. Copy the **manager link** from the cockpit header (`/m/<token>`).
3. Manager adds todos / reviews (notes + page URL; optional screenshot).
4. Owner promotes inbox items into a plan + tasks.
5. Task status changes (Ready / Doing / Done / Blocked) show on the same manager link.

Data is stored in local SQLite at `data/tracker.sqlite`. Uploads go to `public/uploads/`.

## Scripts

- `npm run dev` — development server on port 43127
- `npm run build` / `npm start` — production build
