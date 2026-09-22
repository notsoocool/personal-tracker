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
