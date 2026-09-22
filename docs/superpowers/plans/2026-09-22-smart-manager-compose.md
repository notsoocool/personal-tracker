# Smart Manager Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace blank manager todo/review forms with one Flit-focused compose box + template chips + confirm strip, and optional OpenAI “Shape this” when `OPENAI_API_KEY` is set; polish cockpit empty-state copy only (paste-JSON promote stays).

**Architecture:** Pure helpers for Flit chips and local heuristics; server-only OpenAI shaper behind `POST /api/smart/shape-inbox` (manager token auth); manager UI becomes compose → optional shape → editable confirm → existing `managerAddTodoAction` / `managerAddReviewAction`. Owner cockpit empty copy only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, better-sqlite3 (unchanged), OpenAI HTTP API via `fetch` (no SDK required), existing shadcn/ui primitives, `tsx` smoke tests like `test:handoff`.

## Global Constraints

- Do not touch `flit-frontend`; work only in `personal-tracker`.
- Keep paste-JSON promote on cockpit unchanged.
- Never expose `OPENAI_API_KEY` to the client; client gets boolean `aiEnabled` only.
- Manager auth remains secret link token (no new accounts).
- Four Flit chips only in v1: Bug on this page, UI feels off, Missing feature, Please review this screen.
- Tasks/copy for managers stay human-readable (no API/file jargon in UI strings).
- Prefer existing create actions over new write paths for inbox inserts.
- Spec: `docs/superpowers/specs/2026-09-22-smart-manager-compose-design.md`.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/smart-templates.ts` | Flit chip catalog + seed text |
| `src/lib/smart-heuristics.ts` | Local draft from compose text (no AI) |
| `src/lib/openai-shape.ts` | Server OpenAI call + validate shaped payload |
| `src/app/api/smart/shape-inbox/route.ts` | Token-auth HTTP endpoint |
| `src/components/manager-smart-compose.tsx` | Compose + chips + Shape + confirm strip |
| `src/components/manager-client.tsx` | Wire smart compose; keep story/progress |
| `src/app/m/[token]/page.tsx` | Pass `aiEnabled` |
| `src/components/cockpit-client.tsx` | Clearer empty-state copy |
| `scripts/test-smart-compose.ts` | Unit smoke for templates/heuristics/shape parse |
| `package.json` | `test:smart` script |
| `README.md` | Document optional OpenAI env |

---

### Task 1: Flit template catalog

**Files:**
- Create: `src/lib/smart-templates.ts`
- Create: `scripts/test-smart-compose.ts` (start here; grow in later tasks)
- Modify: `package.json` (add `test:smart`)

**Interfaces:**
- Produces:
  - `export type SmartChipId = "bug-page" | "ui-off" | "missing-feature" | "review-screen"`
  - `export type SmartTemplate = { id: SmartChipId; label: string; defaultType: InboxType; seedText: string }`
  - `export const FLIT_SMART_TEMPLATES: SmartTemplate[]`
  - `export function getSmartTemplate(id: string): SmartTemplate | undefined`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-smart-compose.ts`:

```ts
import assert from "node:assert/strict";
import {
  FLIT_SMART_TEMPLATES,
  getSmartTemplate,
} from "../src/lib/smart-templates";

assert.equal(FLIT_SMART_TEMPLATES.length, 4);
assert.ok(getSmartTemplate("bug-page"));
assert.equal(getSmartTemplate("bug-page")?.defaultType, "review");
assert.equal(getSmartTemplate("missing-feature")?.defaultType, "todo");
assert.match(getSmartTemplate("bug-page")!.seedText, /URL|url|page/i);
assert.equal(getSmartTemplate("nope"), undefined);

console.log("smart-compose tests passed (templates)");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --yes tsx scripts/test-smart-compose.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/smart-templates.ts`:

```ts
import type { InboxType } from "./types";

export type SmartChipId =
  | "bug-page"
  | "ui-off"
  | "missing-feature"
  | "review-screen";

export type SmartTemplate = {
  id: SmartChipId;
  label: string;
  defaultType: InboxType;
  seedText: string;
};

export const FLIT_SMART_TEMPLATES: SmartTemplate[] = [
  {
    id: "bug-page",
    label: "Bug on this page",
    defaultType: "review",
    seedText:
      "Something is broken on this Flit page.\nWhat happens: \nWhat I expected: \nPage URL: https://",
  },
  {
    id: "ui-off",
    label: "UI feels off",
    defaultType: "review",
    seedText:
      "This Flit screen feels visually off.\nWhat looks wrong: \nPage URL: https://",
  },
  {
    id: "missing-feature",
    label: "Missing feature",
    defaultType: "todo",
    seedText:
      "Flit needs a feature that isn’t there yet.\nWhat I need: \nWhy it matters: ",
  },
  {
    id: "review-screen",
    label: "Please review this screen",
    defaultType: "review",
    seedText:
      "Please review this Flit screen and share what should change.\nPage URL: https://",
  },
];

export function getSmartTemplate(id: string): SmartTemplate | undefined {
  return FLIT_SMART_TEMPLATES.find((t) => t.id === id);
}
```

Add to `package.json` scripts:

```json
"test:smart": "npx --yes tsx scripts/test-smart-compose.ts"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:smart`  
Expected: `smart-compose tests passed (templates)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/smart-templates.ts scripts/test-smart-compose.ts package.json
git commit -m "Add Flit smart-compose template chips catalog"
```

---

### Task 2: Local heuristics (no AI)

**Files:**
- Create: `src/lib/smart-heuristics.ts`
- Modify: `scripts/test-smart-compose.ts`

**Interfaces:**
- Consumes: `getSmartTemplate`, `SmartChipId`, `InboxType`
- Produces:
  - `export type ShapedInboxDraft = { type: InboxType; title: string; notes: string; pageUrl: string | null }`
  - `export function draftFromCompose(input: { text: string; chipId?: string | null }): ShapedInboxDraft`

- [ ] **Step 1: Extend failing tests**

Append to `scripts/test-smart-compose.ts`:

```ts
import { draftFromCompose } from "../src/lib/smart-heuristics";

const reviewDraft = draftFromCompose({
  text: "Button is broken on this page\nPage URL: https://example.com/haiku",
  chipId: "bug-page",
});
assert.equal(reviewDraft.type, "review");
assert.ok(reviewDraft.title.length > 0);
assert.equal(reviewDraft.pageUrl, "https://example.com/haiku");

const todoDraft = draftFromCompose({
  text: "Please add export to CSV for rooms",
  chipId: "missing-feature",
});
assert.equal(todoDraft.type, "todo");
assert.match(todoDraft.title, /export|CSV|rooms/i);

const emptyish = draftFromCompose({ text: "   " });
assert.equal(emptyish.title, "New ask");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:smart`  
Expected: FAIL (heuristics module missing)

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/smart-heuristics.ts`:

```ts
import { getSmartTemplate } from "./smart-templates";
import type { InboxType } from "./types";

export type ShapedInboxDraft = {
  type: InboxType;
  title: string;
  notes: string;
  pageUrl: string | null;
};

const URL_RE = /https?:\/\/[^\s)]+/i;
const REVIEW_HINT =
  /\b(review|screen|page|url|ui|bug|broken|looks|visual)\b/i;

export function draftFromCompose(input: {
  text: string;
  chipId?: string | null;
}): ShapedInboxDraft {
  const raw = input.text.trim();
  const chip = input.chipId ? getSmartTemplate(input.chipId) : undefined;
  const urlMatch = raw.match(URL_RE);
  const pageUrl = urlMatch?.[0] ?? null;

  let type: InboxType =
    chip?.defaultType ??
    (pageUrl || REVIEW_HINT.test(raw) ? "review" : "todo");

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let title =
    lines.find((l) => !/^page url:/i.test(l) && !URL_RE.test(l)) ?? "";
  title = title.replace(/^[-*•]\s*/, "").slice(0, 120).trim();
  if (!title) title = chip?.label ?? "New ask";

  const notes = raw || chip?.seedText || "";

  if (type === "todo") {
    return { type, title, notes, pageUrl: null };
  }
  return { type, title, notes, pageUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:smart`  
Expected: PASS (templates + heuristics)

- [ ] **Step 5: Commit**

```bash
git add src/lib/smart-heuristics.ts scripts/test-smart-compose.ts
git commit -m "Add local heuristics for manager smart compose drafts"
```

---

### Task 3: Manager smart compose UI (no OpenAI yet)

**Files:**
- Create: `src/components/manager-smart-compose.tsx`
- Modify: `src/components/manager-client.tsx` (replace Add todo / Add review tab bodies with smart compose; keep Progress tab + story)
- Modify: `src/app/m/[token]/page.tsx` (pass `aiEnabled={false}` for now, or detect key)

**Interfaces:**
- Consumes: `FLIT_SMART_TEMPLATES`, `draftFromCompose`, `managerAddTodoAction`, `managerAddReviewAction`
- Produces: `<ManagerSmartCompose token projectName aiEnabled />`

- [ ] **Step 1: Build `ManagerSmartCompose`**

Create `src/components/manager-smart-compose.tsx` with this behavior:

1. Header copy: “Tell Flit what’s wrong or what you need — one note is enough.”
2. Legend: Todo = do this next; Review = look at this page (needs a URL).
3. Chip row from `FLIT_SMART_TEMPLATES` — on click set `compose` to `seedText`, set `chipId`, call `draftFromCompose` into confirm state, set `showConfirm=true`.
4. Textarea bound to `compose`.
5. Buttons: **Preview** (runs `draftFromCompose` → confirm strip) and **Send** (disabled until confirm valid). Hide **Shape this** when `!aiEnabled`.
6. Confirm strip fields: type toggle (todo/review), title `Input`, notes `Textarea`, pageUrl `Input` (shown if review). Block send if title empty or (review && !pageUrl).
7. On send: build `FormData` and call `managerAddTodoAction` or `managerAddReviewAction`; on ok clear compose/confirm and show success message via callback props.

Skeleton (complete in file — keep styles consistent with `glass-panel` / existing Button/Input/Textarea/Badge):

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  managerAddReviewAction,
  managerAddTodoAction,
} from "@/lib/actions";
import {
  draftFromCompose,
  type ShapedInboxDraft,
} from "@/lib/smart-heuristics";
import { FLIT_SMART_TEMPLATES } from "@/lib/smart-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  token: string;
  projectName: string;
  aiEnabled: boolean;
  onMessage: (msg: string | null) => void;
  onError: (err: string | null) => void;
};

export function ManagerSmartCompose({
  token,
  projectName,
  aiEnabled,
  onMessage,
  onError,
}: Props) {
  const [compose, setCompose] = useState("");
  const [chipId, setChipId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShapedInboxDraft | null>(null);
  const [urlError, setUrlError] = useState(false);
  const [pending, startTransition] = useTransition();
  // Shape wiring lands in Task 5; keep prop used so lint is clean:
  void aiEnabled;

  function applyDraft(next: ShapedInboxDraft) {
    setDraft(next);
    setUrlError(false);
  }

  function preview() {
    if (!compose.trim()) {
      onError("Write a short note first.");
      return;
    }
    onError(null);
    applyDraft(draftFromCompose({ text: compose, chipId }));
  }

  function send() {
    if (!draft) {
      preview();
      return;
    }
    if (!draft.title.trim()) {
      onError("Add a short title in the confirm strip.");
      return;
    }
    if (draft.type === "review" && !draft.pageUrl?.trim()) {
      setUrlError(true);
      onError("Reviews need a page URL.");
      return;
    }
    const fd = new FormData();
    fd.set("title", draft.title.trim());
    fd.set("notes", draft.notes);
    if (draft.type === "review") fd.set("pageUrl", draft.pageUrl!.trim());

    startTransition(async () => {
      onMessage(null);
      onError(null);
      const result =
        draft.type === "review"
          ? await managerAddReviewAction(token, fd)
          : await managerAddTodoAction(token, fd);
      if (result?.error) {
        onError(result.error);
        return;
      }
      setCompose("");
      setChipId(null);
      setDraft(null);
      onMessage(draft.type === "review" ? "Review added." : "Todo added.");
    });
  }

  return (
    <article className="glass-panel rounded-2xl p-5">
      <h2 className="font-display text-lg font-semibold">Drop an ask</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell {projectName} what’s wrong or what you need — one note is enough.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="text-foreground">Todo</span> = do this next ·{" "}
        <span className="text-foreground">Review</span> = look at this page
        (needs a URL)
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FLIT_SMART_TEMPLATES.map((chip) => (
          <Button
            key={chip.id}
            type="button"
            size="sm"
            variant={chipId === chip.id ? "default" : "outline"}
            onClick={() => {
              setChipId(chip.id);
              setCompose(chip.seedText);
              applyDraft(
                draftFromCompose({ text: chip.seedText, chipId: chip.id }),
              );
            }}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="smart-compose">Your note</Label>
        <Textarea
          id="smart-compose"
          rows={6}
          value={compose}
          onChange={(e) => setCompose(e.target.value)}
          placeholder="What should we look at or do?"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={preview} disabled={pending}>
          Preview
        </Button>
        <Button type="button" onClick={send} disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>

      {draft ? (
        <div className="mt-5 space-y-3 rounded-xl border border-cyan/20 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Confirm
            </span>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  type: "todo",
                  pageUrl: null,
                })
              }
            >
              <Badge variant={draft.type === "todo" ? "default" : "outline"}>
                todo
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, type: "review" })}
            >
              <Badge variant={draft.type === "review" ? "default" : "outline"}>
                review
              </Badge>
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-title">Title</Label>
            <Input
              id="confirm-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-notes">Notes</Label>
            <Textarea
              id="confirm-notes"
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          {draft.type === "review" ? (
            <div className="space-y-2">
              <Label htmlFor="confirm-url">Page URL</Label>
              <Input
                id="confirm-url"
                type="url"
                value={draft.pageUrl ?? ""}
                className={urlError ? "border-destructive" : undefined}
                onChange={(e) => {
                  setUrlError(false);
                  setDraft({ ...draft, pageUrl: e.target.value });
                }}
                placeholder="https://"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 2: Wire into manager page**

In `manager-client.tsx`:
- Import `ManagerSmartCompose`.
- Replace the Tabs default that forces separate todo/review forms: change tabs to `ask` | `progress` (or keep three tabs but make todo+review both render smart compose — simplest: **one “Drop an ask” tab + Progress**).
- Remove the old blank todo/review form JSX.
- Pass `aiEnabled` prop from page (add to `ManagerClient` props).

In `src/app/m/[token]/page.tsx`:

```tsx
const aiEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());
// ...
<ManagerClient
  token={token}
  projectName={project.name}
  inbox={inbox}
  plans={plans}
  tasks={tasks}
  counts={counts}
  aiEnabled={aiEnabled}
/>
```

- [ ] **Step 3: Manual smoke (no AI)**

Run: `npm run dev`  
Open manager link → tap **Bug on this page** → fill URL → Preview/Send → item appears in Waiting on you + owner Inbox.

- [ ] **Step 4: Commit**

```bash
git add src/components/manager-smart-compose.tsx src/components/manager-client.tsx src/app/m/[token]/page.tsx
git commit -m "Replace manager forms with smart compose and Flit chips"
```

---

### Task 4: OpenAI shape helper + API route

**Files:**
- Create: `src/lib/openai-shape.ts`
- Create: `src/app/api/smart/shape-inbox/route.ts`
- Modify: `scripts/test-smart-compose.ts` (parse/validate tests)

**Interfaces:**
- Produces:
  - `export function isOpenAIConfigured(): boolean`
  - `export function parseShapedInboxPayload(value: unknown): ShapedInboxDraft | null`
  - `export async function shapeInboxWithOpenAI(input: { text: string; chipId?: string | null; projectName: string }): Promise<ShapedInboxDraft>`
  - Route: `POST /api/smart/shape-inbox` body `{ token, text, chipId? }`

- [ ] **Step 1: Write parse tests**

Append:

```ts
import { parseShapedInboxPayload } from "../src/lib/openai-shape";

assert.deepEqual(
  parseShapedInboxPayload({
    type: "review",
    title: "Broken save",
    notes: "Settings do not save",
    pageUrl: "https://x.test/settings",
  }),
  {
    type: "review",
    title: "Broken save",
    notes: "Settings do not save",
    pageUrl: "https://x.test/settings",
  },
);
assert.equal(parseShapedInboxPayload({ type: "todo", title: "" }), null);
assert.equal(parseShapedInboxPayload({ type: "nope", title: "x" }), null);
```

- [ ] **Step 2: Run to verify fail, then implement `openai-shape.ts`**

```ts
import { draftFromCompose, type ShapedInboxDraft } from "./smart-heuristics";
import { getSmartTemplate } from "./smart-templates";

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function parseShapedInboxPayload(value: unknown): ShapedInboxDraft | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const type = v.type === "todo" || v.type === "review" ? v.type : null;
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (!type || !title) return null;
  const notes = typeof v.notes === "string" ? v.notes : "";
  const pageUrlRaw =
    typeof v.pageUrl === "string"
      ? v.pageUrl.trim()
      : typeof v.page_url === "string"
        ? v.page_url.trim()
        : "";
  const pageUrl = pageUrlRaw || null;
  if (type === "todo") return { type, title, notes, pageUrl: null };
  return { type, title, notes, pageUrl };
}

export async function shapeInboxWithOpenAI(input: {
  text: string;
  chipId?: string | null;
  projectName: string;
}): Promise<ShapedInboxDraft> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const chip = input.chipId ? getSmartTemplate(input.chipId) : undefined;

  const system = `You turn a manager's rough note about the product ${input.projectName} into a clear inbox item.
Return JSON only: {"type":"todo"|"review","title":"string","notes":"string","pageUrl":string|null}.
Use type "review" when they want someone to look at a page/screen; include pageUrl if present or null.
Use type "todo" for work asks. Title must be short and human. No code jargon.`;

  const user = [
    chip ? `Chosen starter: ${chip.label}` : null,
    "Note:",
    input.text.trim(),
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON");
  }
  const shaped = parseShapedInboxPayload(parsed);
  if (!shaped) throw new Error("OpenAI JSON missing fields");
  return shaped;
}

/** Fallback used by API on failure */
export function shapeInboxFallback(input: {
  text: string;
  chipId?: string | null;
}): ShapedInboxDraft {
  return draftFromCompose(input);
}
```

- [ ] **Step 3: Implement route**

Create `src/app/api/smart/shape-inbox/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getManagerLinkByToken, getProject } from "@/lib/db";
import {
  isOpenAIConfigured,
  shapeInboxFallback,
  shapeInboxWithOpenAI,
} from "@/lib/openai-shape";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { token?: string; text?: string; chipId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = String(body.token || "").trim();
  const text = String(body.text || "").trim();
  const chipId = body.chipId ? String(body.chipId) : null;

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 401 });
  }
  const link = getManagerLinkByToken(token);
  if (!link) {
    return NextResponse.json({ error: "Invalid or revoked link" }, { status: 401 });
  }
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const project = getProject(link.project_id);
  const projectName = project?.name ?? "Flit";

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "AI polish not configured", draft: shapeInboxFallback({ text, chipId }) },
      { status: 503 },
    );
  }

  try {
    const draft = await shapeInboxWithOpenAI({ text, chipId, projectName });
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json(
      {
        error: "Couldn’t polish — edit and send anyway.",
        draft: shapeInboxFallback({ text, chipId }),
      },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Run unit tests**

Run: `npm run test:smart`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/openai-shape.ts src/app/api/smart/shape-inbox/route.ts scripts/test-smart-compose.ts
git commit -m "Add OpenAI shape-inbox helper and manager API route"
```

---

### Task 5: Wire “Shape this” button

**Files:**
- Modify: `src/components/manager-smart-compose.tsx`

**Interfaces:**
- Consumes: `POST /api/smart/shape-inbox` → `{ draft }` or error + optional `draft`

- [ ] **Step 1: Add Shape control**

When `aiEnabled`:
- Show button **Shape this** next to Preview.
- On click: `fetch("/api/smart/shape-inbox", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ token, text: compose, chipId }) })`
- On 200: `setDraft(data.draft)`
- On 502/503 with `draft`: apply draft + `onError(data.error || "Couldn't polish — edit and send anyway.")`
- On other errors: soft banner; still run `draftFromCompose` locally so confirm appears

When `!aiEnabled`: do not show Shape (Preview + Send only).

- [ ] **Step 2: Manual check**

Without key: Shape hidden; chips work.  
With `OPENAI_API_KEY` in `.env.local`: Shape fills confirm strip.

- [ ] **Step 3: Commit**

```bash
git add src/components/manager-smart-compose.tsx
git commit -m "Wire optional Shape this for manager smart compose"
```

---

### Task 6: Cockpit empty-state copy + README

**Files:**
- Modify: `src/components/cockpit-client.tsx` (empty strings only)
- Modify: `README.md`

**Interfaces:** none new

- [ ] **Step 1: Update empty copy**

Use clearer first-run language (examples — keep tone of existing UI):

- Needs triage empty: `Nothing waiting. When your manager sends an ask on the secret link, it shows up here to plan.`
- Inbox empty body: `Manager asks land here first. Use Plan this, then paste the plan JSON back.`
- Plans empty body: `Plans appear after you paste plan JSON from an inbox item.`
- Tasks empty (if any): `Tasks show up once a plan is saved — or add a quick standalone task below.`
- Up next empty: keep actionable: `No ready work yet. Plan an inbox ask or unblock something.`

Do **not** change promote dialog / paste JSON.

- [ ] **Step 2: README env**

Extend optional env block:

```bash
OWNER_PASSWORD=tracker-dev
SESSION_SECRET=change-me
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Add one sentence under How it works: manager link uses compose + Flit chips; optional Shape when OpenAI key is set.

- [ ] **Step 3: Commit**

```bash
git add src/components/cockpit-client.tsx README.md
git commit -m "Clarify cockpit empty states and document OpenAI env"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run automated tests**

```bash
npm run test:smart
npm run test:handoff
```

Expected: both pass

- [ ] **Step 2: Manual checklist**

1. Fresh manager link → chips seed compose → Preview → confirm → Send todo/review  
2. Review without URL blocked  
3. Owner Inbox shows item; paste JSON promote still works  
4. With key: Shape this polishes a rough note  
5. Without key: no Shape button; heuristics still work  

- [ ] **Step 3: Push**

```bash
git push -u origin HEAD
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Compose box + chips | 1, 3 |
| Flit four templates | 1 |
| Confirm strip | 3 |
| Local heuristics / no key | 2, 3 |
| Shape API + OpenAI | 4, 5 |
| Cockpit empty copy only | 6 |
| Paste JSON unchanged | 6 (explicit non-touch) |
| README / env | 6 |
| Tests | 1, 2, 4, 7 |
