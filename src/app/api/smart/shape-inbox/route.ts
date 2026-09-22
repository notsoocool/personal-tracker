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
