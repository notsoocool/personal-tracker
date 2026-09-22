import type { InboxItem } from "./types";

export type ClaudePlanPayload = {
  title: string;
  summary: string;
  tasks: string[];
};

/** Build a paste-ready prompt for /superpowers or Cursor from an inbox item. */
export function buildClaudePlanPrompt(
  item: InboxItem,
  projectName: string,
  origin?: string,
): string {
  const screenshotAbsolute =
    item.screenshot_url && origin
      ? `${origin}${item.screenshot_url}`
      : item.screenshot_url;

  const lines = [
    `Plan work for Personal Tracker (active project: ${projectName}).`,
    "",
    "Run this in Cursor OR Claude — same repo, same /superpowers flow.",
    "Use /superpowers (or equivalent planning) to turn this inbox item into a plan + actionable tasks.",
    "Return JSON only, matching this shape:",
    "",
    "```json",
    "{",
    '  "title": "Plan title",',
    '  "summary": "1-3 sentence summary in plain language",',
    '  "tasks": ["Confirm what is broken on the page", "Make the setting save correctly"]',
    "}",
    "```",
    "",
    "## Inbox item",
    `Type: ${item.type}`,
    `Title: ${item.title}`,
  ];

  if (item.notes?.trim()) {
    lines.push("", "Notes:", item.notes.trim());
  }
  if (item.page_url?.trim()) {
    lines.push("", `Page URL: ${item.page_url.trim()}`);
  }
  if (screenshotAbsolute?.trim()) {
    lines.push(`Screenshot URL: ${screenshotAbsolute.trim()}`);
  }

  lines.push(
    "",
    "## Constraints",
    "- Write title, summary, and tasks in plain human language a non-engineer manager can understand.",
    "- Tasks describe the outcome or user-visible step (what to check, fix, or verify) — not code, APIs, files, components, or implementation details.",
    "- Avoid jargon: no “trace the UI”, “API path”, “refactor”, “PR”, “CSS”, “endpoint”, unless the inbox item itself uses that word.",
    "- Tasks should be concrete and shippable in a day or less each.",
    "- Prefer Ready-queue friendly sequencing (first tasks unblocked).",
    "- Do not invent unrelated projects; stay on this inbox item.",
  );

  return lines.join("\n");
}

/**
 * Parse Claude plan output: JSON object, fenced JSON, or loose markdown.
 */
export function parseClaudePlanOutput(raw: string): ClaudePlanPayload | null {
  const text = raw.trim();
  if (!text) return null;

  const fromJson = tryParseJsonPlan(text);
  if (fromJson) return fromJson;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const nested = tryParseJsonPlan(fenced[1].trim());
    if (nested) return nested;
  }

  return tryParseLoosePlan(text);
}

function tryParseJsonPlan(text: string): ClaudePlanPayload | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      title?: unknown;
      summary?: unknown;
      tasks?: unknown;
    };
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    if (!title) return null;
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const tasks = normalizeTaskList(parsed.tasks);
    if (tasks.length === 0) return null;
    return { title, summary, tasks };
  } catch {
    return null;
  }
}

function normalizeTaskList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => {
      if (typeof t === "string") return t.trim();
      if (t && typeof t === "object" && "title" in t) {
        const title = (t as { title?: unknown }).title;
        return typeof title === "string" ? title.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

function tryParseLoosePlan(text: string): ClaudePlanPayload | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^```/.test(l));

  if (lines.length === 0) return null;

  let title = lines[0].replace(/^#+\s*/, "").replace(/^\*\*(.+)\*\*$/, "$1");
  const titleMatch = text.match(/(?:^|\n)\s*(?:title|plan)\s*:\s*(.+)/i);
  if (titleMatch?.[1]) title = titleMatch[1].trim();

  const summaryMatch = text.match(/(?:^|\n)\s*summary\s*:\s*([\s\S]*?)(?=\n\s*(?:tasks?|#|\-|\*)|$)/i);
  let summary = summaryMatch?.[1]?.trim() ?? "";

  const taskLines: string[] = [];
  let inTasks = false;
  for (const line of lines) {
    if (/^tasks?\s*:?\s*$/i.test(line) || /^##?\s*tasks?\b/i.test(line)) {
      inTasks = true;
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)/) || line.match(/^\d+[.)]\s+(.+)/);
    if (bullet) {
      taskLines.push(bullet[1].trim());
      inTasks = true;
      continue;
    }
    if (inTasks && line && !/^(title|summary|plan)\s*:/i.test(line)) {
      taskLines.push(line);
    }
  }

  if (!summary && lines.length > 1 && taskLines.length === 0) {
    summary = lines.slice(1).join("\n");
  }

  if (!title || taskLines.length === 0) return null;
  return { title, summary, tasks: taskLines };
}
