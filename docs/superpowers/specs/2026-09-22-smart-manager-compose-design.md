# Smart manager compose (templates + optional OpenAI)

Date: 2026-09-22  
Status: approved for planning  
Repo: personal-tracker  
Active project label: Flit

## Problem

First-time users (manager and owner) can’t tell what’s what. Manager **Add todo / Add review** are blank forms that feel like busywork. We want capture to feel smart and guided—not a quiz.

## Decisions (locked)

| Choice | Decision |
|--------|----------|
| Surfaces | Both — **manager first**, then light cockpit polish |
| Smartness | **Templates + chips first**; optional OpenAI polish when `OPENAI_API_KEY` is set |
| Templates | **Flit-focused** starter set |
| Interaction model | **Approach 2:** one smart compose box; template chips seed the box |
| Owner promote | **Keep paste-JSON** as today (no AI promote in this slice) |

## Goals

1. Manager can drop a clear ask in under ~30 seconds without knowing todo vs review jargon up front.
2. Works fully without OpenAI (chips + local heuristics).
3. With OpenAI, a rough note becomes a tidy structured draft before send.
4. Owner cockpit: clearer first-run/empty copy only; promote JSON paste unchanged.

## Non-goals

- Cockpit AI “shape into plan” / replacing paste-JSON
- Screenshot → AI vision
- Multi-project template packs
- Background agents or auto-planning
- Changing manager auth (secret link stays)

## Manager UX

### Entry

Above the compose area:

> Tell Flit what’s wrong or what you need — one note is enough.

Tiny legend:

- **Todo** = do this next  
- **Review** = look at this page (needs a URL)

### Template chips (Flit)

Static catalog in code. Tapping a chip inserts starter text into the compose box (editable). Suggested set:

| Chip | Default type | Seeds |
|------|--------------|--------|
| Bug on this page | review | Title/note asking what’s broken + placeholder for page URL |
| UI feels off | review | Visual/UX concern framing + URL placeholder |
| Missing feature | todo | Feature ask framing |
| Please review this screen | review | Review framing + URL placeholder |

Exact copy can be tuned in implementation; keep chip count to these four for v1.

### Compose box (primary)

Single textarea is the main input. Chips seed it; manager edits freely. No mandatory blank Title/Notes/URL fields up front.

### Shape this (optional)

- Visible only when server reports OpenAI configured (or button enabled only if key present).
- Calls server to turn raw note → `{ type, title, notes, pageUrl? }`.
- On failure/timeout: soft banner (“Couldn’t polish — edit and send anyway”); draft kept.

### Confirm strip

After Shape, or after chip/heuristic without AI: show a **compact editable confirm strip** (not a full form-first layout):

- Type badge (todo | review), toggleable
- Title
- Notes
- Page URL (required when type is review)

**Send** creates the inbox item via existing manager actions.

### Without API key

- Chips still prefill compose.
- Local heuristics: if note/chip implies review/screen/page/URL → type `review`; else `todo`.
- Shape button hidden or disabled with short explanation.

## Cockpit UX (this slice)

- Keep **Plan this** + **Paste plan JSON** dialog as today.
- Improve first-run / empty-state copy so Today / Inbox / Plans / Tasks meaning is obvious (one short guided line each).
- No new OpenAI endpoints for owner promote.

## Technical design

### Config

- `OPENAI_API_KEY` in `.env.local` (server-only; never sent to client).
- Optional `OPENAI_MODEL` (default `gpt-4o-mini`).
- Client may know only a boolean `aiEnabled` from server props/API.

### API

`POST /api/smart/shape-inbox`

- Auth: manager link token (same trust model as manager mutations).
- Body: `{ token, text, chipId? }`
- Success: `{ type: "todo" \| "review", title: string, notes: string, pageUrl: string \| null }`
- Errors: 401 invalid token; 503/502 if key missing or upstream failure (UI falls back).

### Modules

- `src/lib/smart-templates.ts` — Flit chip catalog + seed text
- `src/lib/smart-heuristics.ts` — local todo vs review + field draft without AI
- `src/lib/openai-shape.ts` — server OpenAI call + JSON parse/validate
- Manager UI: replace blank dual forms with compose + chips + confirm strip (still can map to existing `managerAddTodoAction` / `managerAddReviewAction`)

### Privacy

- Send to OpenAI only: compose text, optional chip id, project name “Flit”.
- No screenshots in this slice.

## Error handling

| Case | Behavior |
|------|----------|
| Invalid token | Reject like existing manager APIs |
| OpenAI down / timeout | Keep draft; soft banner; send still allowed |
| Review missing URL | Highlight URL; block send until present |
| Empty compose | Block send |

## Testing

- Unit: templates catalog; heuristics (todo vs review).
- API: mocked OpenAI success + failure.
- Manual smoke: chip → compose → (optional Shape) → confirm → inbox item appears for owner.

## Success criteria

- New manager can submit a useful ask without reading a manual.
- No key required for happy path with chips.
- With key, Shape improves messy notes into clear title/notes/type.
- Owner still promotes via paste JSON; empty states are self-explanatory.

## Implementation order

1. Template catalog + heuristics + manager compose UI (no OpenAI).
2. Confirm strip → existing create actions.
3. `shape-inbox` API + Shape button when key present.
4. Cockpit empty-state copy polish.
