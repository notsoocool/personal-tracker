"use client";

import { useMemo, useState, useTransition } from "react";
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
  projectName: _projectName,
  aiEnabled,
  onMessage,
  onError,
}: Props) {
  void _projectName;
  const [compose, setCompose] = useState("");
  const [chipId, setChipId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShapedInboxDraft | null>(null);
  const [urlError, setUrlError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shaping, setShaping] = useState(false);

  const canSend = useMemo(() => {
    if (!draft?.title.trim()) return false;
    if (draft.type === "review" && !draft.pageUrl?.trim()) return false;
    return true;
  }, [draft]);

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

  async function shapeThis() {
    if (!compose.trim()) {
      onError("Write a short note first.");
      return;
    }
    onMessage(null);
    setShaping(true);
    try {
      const res = await fetch("/api/smart/shape-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, text: compose, chipId }),
      });
      let data: { draft?: ShapedInboxDraft; error?: string };
      try {
        data = await res.json();
      } catch {
        onError("Couldn't reach polish — using local preview.");
        applyDraft(draftFromCompose({ text: compose, chipId }));
        return;
      }
      if (res.ok && data.draft) {
        onError(null);
        applyDraft(data.draft);
        return;
      }
      if ((res.status === 502 || res.status === 503) && data.draft) {
        applyDraft(data.draft);
        onError(
          data.error || "Couldn't polish — edit and send anyway.",
        );
        return;
      }
      onError(data.error || "Couldn't polish — using local preview.");
      applyDraft(draftFromCompose({ text: compose, chipId }));
    } catch {
      onError("Couldn't reach polish — using local preview.");
      applyDraft(draftFromCompose({ text: compose, chipId }));
    } finally {
      setShaping(false);
    }
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
      const kind = draft.type;
      setCompose("");
      setChipId(null);
      setDraft(null);
      onMessage(kind === "review" ? "Review added." : "Todo added.");
    });
  }

  return (
    <article className="glass-panel rounded-2xl p-5">
      <h2 className="font-display text-lg font-semibold">Drop an ask</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell Flit what’s wrong or what you need — one note is enough.
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
        <Button
          type="button"
          variant="outline"
          onClick={preview}
          disabled={pending}
        >
          Preview
        </Button>
        {aiEnabled ? (
          <Button
            type="button"
            variant="outline"
            onClick={shapeThis}
            disabled={pending || shaping}
          >
            {shaping ? "Shaping…" : "Shape this"}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={send}
          disabled={pending || !canSend}
        >
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
