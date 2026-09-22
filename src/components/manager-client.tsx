"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  managerAddReviewAction,
  managerAddTodoAction,
  managerDeleteInboxAction,
  managerUpdateInboxAction,
} from "@/lib/actions";
import type { InboxItem, Plan, Task, TaskCounts } from "@/lib/types";
import { PlatformChip } from "@/components/platform-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  token: string;
  projectName: string;
  inbox: InboxItem[];
  plans: Plan[];
  tasks: Task[];
  counts: TaskCounts;
};

function countForPlan(tasks: Task[], planId: string): TaskCounts {
  const counts: TaskCounts = { ready: 0, doing: 0, done: 0, blocked: 0 };
  for (const t of tasks) {
    if (t.plan_id === planId) counts[t.status] += 1;
  }
  return counts;
}

export function ManagerClient({
  token,
  projectName,
  inbox,
  plans,
  tasks,
  counts,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<InboxItem | null>(null);

  const openInbox = inbox.filter((i) => i.status === "new");
  const doing = useMemo(
    () => tasks.filter((t) => t.status === "doing"),
    [tasks],
  );
  const waiting = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "blocked" || t.status === "ready",
      ),
    [tasks],
  );
  const doneRecently = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "done")
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8),
    [tasks],
  );

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="enter-up glass-panel rounded-2xl px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan">
          Manager link
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-glow">
          {projectName} story
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          What’s in progress, what’s waiting on you, and what finished —
          plus drop todos and reviews.
        </p>
      </header>

      <section className="enter-up enter-up-delay-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StoryColumn
          title="In progress"
          empty="Nothing actively being worked."
          accent="cyan"
        >
          {doing.map((task) => (
            <StoryTask key={task.id} task={task} plans={plans} />
          ))}
        </StoryColumn>
        <StoryColumn
          title="Waiting on you"
          empty="No open asks right now."
          accent="amber"
        >
          {openInbox.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-warning/25 bg-warning/5 px-3 py-2.5"
            >
              <div className="mb-1 flex flex-wrap gap-1.5">
                <Badge variant="outline">{item.type}</Badge>
                <Badge variant="secondary">needs plan</Badge>
              </div>
              <p className="text-sm font-medium">{item.title}</p>
            </div>
          ))}
          {waiting
            .filter((t) => t.status === "blocked")
            .map((task) => (
              <StoryTask key={task.id} task={task} plans={plans} />
            ))}
        </StoryColumn>
        <StoryColumn
          title="Done recently"
          empty="No completed tasks yet."
          accent="green"
        >
          {doneRecently.map((task) => (
            <StoryTask key={task.id} task={task} plans={plans} />
          ))}
        </StoryColumn>
      </section>

      <section className="enter-up enter-up-delay-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Ready", counts.ready],
            ["Doing", counts.doing],
            ["Done", counts.done],
            ["Blocked", counts.blocked],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="glass-panel rounded-xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ice">
              {value}
            </p>
          </div>
        ))}
      </section>

      <Tabs defaultValue="todo" className="enter-up enter-up-delay-3">
        <TabsList className="glass-panel">
          <TabsTrigger value="todo">Add todo</TabsTrigger>
          <TabsTrigger value="review">Add review</TabsTrigger>
          <TabsTrigger value="progress">Inbox & plans</TabsTrigger>
        </TabsList>

        <TabsContent value="todo" className="mt-4">
          <article className="glass-panel rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold">Add a todo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lands in the owner inbox for {projectName}.
            </p>
            <form
              className="mt-4 space-y-4"
              action={(fd) => {
                setMessage(null);
                setError(null);
                startTransition(async () => {
                  const result = await managerAddTodoAction(token, fd);
                  if (result?.error) {
                    setError(result.error);
                    return;
                  }
                  setMessage("Todo added.");
                  (
                    document.getElementById(
                      "todo-form",
                    ) as HTMLFormElement | null
                  )?.reset();
                });
              }}
              id="todo-form"
            >
              <div className="space-y-2">
                <Label htmlFor="todo-title">Title</Label>
                <Input id="todo-title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="todo-notes">Notes (optional)</Label>
                <Textarea id="todo-notes" name="notes" rows={3} />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Submit todo"}
              </Button>
            </form>
          </article>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <article className="glass-panel rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold">Add a review</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Include the exact page URL. Screenshot optional.
            </p>
            <form
              className="mt-4 space-y-4"
              id="review-form"
              action={(fd) => {
                setMessage(null);
                setError(null);
                startTransition(async () => {
                  const result = await managerAddReviewAction(token, fd);
                  if (result?.error) {
                    setError(result.error);
                    return;
                  }
                  setMessage("Review added.");
                  (
                    document.getElementById(
                      "review-form",
                    ) as HTMLFormElement | null
                  )?.reset();
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="review-title">Title</Label>
                <Input id="review-title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-url">Page / section URL</Label>
                <Input
                  id="review-url"
                  name="pageUrl"
                  type="url"
                  placeholder="https://…"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-notes">Notes</Label>
                <Textarea id="review-notes" name="notes" rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-shot">Screenshot (optional)</Label>
                <Input
                  id="review-shot"
                  name="screenshot"
                  type="file"
                  accept="image/*"
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Submit review"}
              </Button>
            </form>
          </article>
        </TabsContent>

        <TabsContent value="progress" className="mt-4 space-y-4">
          <article className="glass-panel rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold">Open inbox</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit or delete while still new / unplanned.
            </p>
            <div className="mt-4 space-y-3">
              {openInbox.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No open inbox items.
                </p>
              ) : (
                openInbox.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3"
                  >
                    <div className="mb-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      <Badge variant="secondary">{item.status}</Badge>
                    </div>
                    <p className="font-medium">{item.title}</p>
                    {item.notes ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.notes}
                      </p>
                    ) : null}
                    {item.page_url ? (
                      <a
                        href={item.page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm text-cyan underline underline-offset-4"
                      >
                        {item.page_url}
                      </a>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          setMessage(null);
                          setError(null);
                          startTransition(async () => {
                            const result = await managerDeleteInboxAction(
                              token,
                              item.id,
                            );
                            if (result?.error) {
                              setError(result.error);
                              return;
                            }
                            setMessage("Deleted.");
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="glass-panel rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold">Plans</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live task counts from the cockpit.
            </p>
            <div className="mt-4 space-y-3">
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No plans yet.</p>
              ) : (
                plans.map((plan) => {
                  const planTasks = tasks.filter((t) => t.plan_id === plan.id);
                  const breakdown = countForPlan(tasks, plan.id);
                  const total =
                    breakdown.ready +
                    breakdown.doing +
                    breakdown.done +
                    breakdown.blocked;
                  return (
                    <div
                      key={plan.id}
                      className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3"
                    >
                      <div className="mb-1 flex flex-wrap gap-2">
                        <Badge variant="outline">{plan.status}</Badge>
                        <Badge variant="secondary">
                          {breakdown.done}/{total} done
                        </Badge>
                      </div>
                      <p className="font-medium">{plan.title}</p>
                      <StatusBreakdown counts={breakdown} />
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {planTasks.map((task) => (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>{task.title}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <PlatformChip platform={task.work_platform} />
                              <span className="capitalize">{task.status}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="border-cyan/20 bg-[oklch(0.16_0.04_240/95%)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit inbox item</DialogTitle>
            <DialogDescription>
              Only available while the item is still new / unplanned.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-4"
              action={(fd) => {
                setMessage(null);
                setError(null);
                startTransition(async () => {
                  const result = await managerUpdateInboxAction(token, fd);
                  if (result?.error) {
                    setError(result.error);
                    return;
                  }
                  setMessage("Updated.");
                  setEditing(null);
                });
              }}
            >
              <input type="hidden" name="inboxId" value={editing.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={editing.title}
                  required
                />
              </div>
              {editing.type === "review" ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-url">Page / section URL</Label>
                  <Input
                    id="edit-url"
                    name="pageUrl"
                    type="url"
                    defaultValue={editing.page_url ?? ""}
                    required
                  />
                </div>
              ) : (
                <input type="hidden" name="pageUrl" value="" />
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  name="notes"
                  rows={4}
                  defaultValue={editing.notes ?? ""}
                />
              </div>
              {editing.type === "review" ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-shot">
                    Replace screenshot (optional)
                  </Label>
                  <Input
                    id="edit-shot"
                    name="screenshot"
                    type="file"
                    accept="image/*"
                  />
                </div>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-ice" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function StoryColumn({
  title,
  empty,
  children,
  accent,
}: {
  title: string;
  empty: string;
  children: ReactNode;
  accent: "cyan" | "amber" | "green";
}) {
  const border =
    accent === "cyan"
      ? "border-cyan/25"
      : accent === "amber"
        ? "border-warning/25"
        : "border-success/25";
  const childArray = Array.isArray(children)
    ? children.flat().filter(Boolean)
    : children
      ? [children]
      : [];
  return (
    <div className={`glass-panel rounded-2xl border ${border} p-4`}>
      <h2 className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {childArray.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function StoryTask({ task, plans }: { task: Task; plans: Plan[] }) {
  const plan = plans.find((p) => p.id === task.plan_id);
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <PlatformChip platform={task.work_platform} />
        <Badge variant="secondary" className="capitalize">
          {task.status}
        </Badge>
      </div>
      <p className="text-sm font-medium">{task.title}</p>
      <p className="text-[11px] text-muted-foreground">
        {plan ? plan.title : "Standalone"}
      </p>
    </div>
  );
}

function StatusBreakdown({ counts }: { counts: TaskCounts }) {
  const total = counts.ready + counts.doing + counts.done + counts.blocked;
  if (total === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">No tasks yet</p>;
  }
  const segments: {
    key: keyof TaskCounts;
    label: string;
    className: string;
  }[] = [
    { key: "done", label: "Done", className: "bg-success" },
    { key: "doing", label: "Doing", className: "bg-cyan" },
    { key: "ready", label: "Ready", className: "bg-cyan/40" },
    { key: "blocked", label: "Blocked", className: "bg-destructive/70" },
  ];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {segments.map((s) => {
          const n = counts[s.key];
          if (!n) return null;
          return (
            <div
              key={s.key}
              className={s.className}
              style={{ width: `${(n / total) * 100}%` }}
              title={`${s.label}: ${n}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.key}>
            {s.label}{" "}
            <span className="tabular-nums text-foreground">{counts[s.key]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
