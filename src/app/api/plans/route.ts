import { NextResponse } from "next/server";
import { isOwnerAuthenticated } from "@/lib/auth";
import { getInboxItem, promoteInboxToPlan } from "@/lib/db";
import { parseClaudePlanOutput } from "@/lib/claude-handoff";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type Body = {
  inboxItemId?: string;
  title?: string;
  summary?: string;
  tasks?: string[] | string;
  /** Raw Claude /superpowers output (JSON or loose markdown). */
  claudeOutput?: string;
};

/**
 * Authenticated owner API: create plan + tasks from JSON (or Claude paste).
 * Cookie session required (same as cockpit login).
 */
export async function POST(request: Request) {
  if (!(await isOwnerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inboxItemId = String(body.inboxItemId || "").trim();
  if (!inboxItemId) {
    return NextResponse.json(
      { error: "inboxItemId is required" },
      { status: 400 },
    );
  }

  const item = getInboxItem(inboxItemId);
  if (!item) {
    return NextResponse.json({ error: "Inbox item not found" }, { status: 404 });
  }
  if (item.status !== "new") {
    return NextResponse.json(
      { error: "Inbox item is already planned or dismissed" },
      { status: 409 },
    );
  }

  let title = typeof body.title === "string" ? body.title.trim() : "";
  let summary = typeof body.summary === "string" ? body.summary.trim() : "";
  let tasks: string[] = [];

  if (Array.isArray(body.tasks)) {
    tasks = body.tasks.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof body.tasks === "string") {
    tasks = body.tasks
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (body.claudeOutput?.trim()) {
    const parsed = parseClaudePlanOutput(body.claudeOutput);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Could not parse claudeOutput. Expect JSON with title, summary, tasks[].",
        },
        { status: 400 },
      );
    }
    title = parsed.title;
    summary = parsed.summary;
    tasks = parsed.tasks;
  }

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (tasks.length === 0) {
    return NextResponse.json(
      { error: "tasks must include at least one item" },
      { status: 400 },
    );
  }

  const result = promoteInboxToPlan({
    inboxItemId,
    planTitle: title,
    planSummary: summary || undefined,
    taskTitles: tasks,
  });

  revalidatePath("/cockpit");
  revalidatePath("/m", "layout");

  return NextResponse.json({
    ok: true,
    plan: result.plan,
    tasks: result.tasks,
  });
}
