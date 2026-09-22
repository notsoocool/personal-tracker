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
