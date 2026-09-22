"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createStandaloneTaskAction,
  logoutAction,
  promoteInboxAction,
  regenerateLinkAction,
  updateInboxStatusAction,
  updatePlanStatusAction,
  updateTaskStatusAction,
} from "@/lib/actions";
import {
  buildClaudePlanPrompt,
  parseClaudePlanOutput,
} from "@/lib/claude-handoff";
import type { InboxItem, Plan, Task, TaskCounts } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  projectName: string;
  managerPath: string;
  inbox: InboxItem[];
  plans: Plan[];
  tasks: Task[];
  counts: TaskCounts;
};

const TASK_STATUSES = ["ready", "doing", "done", "blocked"] as const;

function countForPlan(tasks: Task[], planId: string): TaskCounts {
  const counts: TaskCounts = { ready: 0, doing: 0, done: 0, blocked: 0 };
  for (const t of tasks) {
    if (t.plan_id === planId) counts[t.status] += 1;
  }
  return counts;
}

export function CockpitClient({
  projectName,
  managerPath,
  inbox,
  plans,
  tasks,
  counts,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [promptCopiedId, setPromptCopiedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [openPromoteId, setOpenPromoteId] = useState<string | null>(null);
  const [claudePaste, setClaudePaste] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planSummary, setPlanSummary] = useState("");
  const [planTasks, setPlanTasks] = useState("");

  const newInbox = inbox.filter((i) => i.status === "new");
  const readyTasks = useMemo(
    () => tasks.filter((t) => t.status === "ready"),
    [tasks],
  );
  const doingTasks = useMemo(
    () => tasks.filter((t) => t.status === "doing"),
    [tasks],
  );
  const blockedTasks = useMemo(
    () => tasks.filter((t) => t.status === "blocked"),
    [tasks],
  );

  function copyLink() {
    const url = `${window.location.origin}${managerPath}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyClaudePrompt(item: InboxItem) {
    const prompt = buildClaudePlanPrompt(
      item,
      projectName,
      window.location.origin,
    );
    void navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopiedId(item.id);
      setTimeout(() => setPromptCopiedId(null), 2000);
    });
  }

  function openPromote(item: InboxItem) {
    setOpenPromoteId(item.id);
    setPromoteError(null);
    setClaudePaste("");
    setPlanTitle(item.title);
    setPlanSummary(item.notes ?? "");
    setPlanTasks("");
  }

  function applyClaudePaste(raw: string) {
    setClaudePaste(raw);
    const parsed = parseClaudePlanOutput(raw);
    if (!parsed) {
      setPromoteError(
        raw.trim()
          ? "Could not parse yet — keep pasting full JSON with title, summary, tasks[]."
          : null,
      );
      return;
    }
    setPromoteError(null);
    setPlanTitle(parsed.title);
    setPlanSummary(parsed.summary);
    setPlanTasks(parsed.tasks.join("\n"));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Personal Tracker
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Cockpit
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Active project:{" "}
            <span className="font-medium text-foreground">{projectName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            {copied ? "Copied" : "Copy manager link"}
          </Button>
          <form action={regenerateLinkAction}>
            <Button type="submit" variant="ghost" size="sm">
              Regenerate link
            </Button>
          </form>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["Ready", counts.ready],
            ["Doing", counts.doing],
            ["Done", counts.done],
            ["Blocked", counts.blocked],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <Tabs defaultValue="ready">
        <TabsList>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="inbox">
            Inbox
            {newInbox.length > 0 ? (
              <Badge variant="secondary" className="ml-2">
                {newInbox.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="mt-4 space-y-6">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm font-medium">Today's focus</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Day-oriented queue — what’s next, what’s blocked, what you’re
              already doing. Not a calendar.
            </p>
          </div>

          <ReadyColumn
            title="Doing now"
            empty="Nothing in progress. Pull something from Ready."
            tasks={doingTasks}
            plans={plans}
            pending={pending}
            onStatus={(id, status) =>
              startTransition(() => updateTaskStatusAction(id, status))
            }
          />
          <ReadyColumn
            title="Ready next"
            empty="No ready tasks. Promote an inbox item or unblock work."
            tasks={readyTasks}
            plans={plans}
            pending={pending}
            highlight
            onStatus={(id, status) =>
              startTransition(() => updateTaskStatusAction(id, status))
            }
          />
          <ReadyColumn
            title="Blocked"
            empty="Nothing blocked."
            tasks={blockedTasks}
            plans={plans}
            pending={pending}
            onStatus={(id, status) =>
              startTransition(() => updateTaskStatusAction(id, status))
            }
          />
        </TabsContent>

        <TabsContent value="inbox" className="mt-4 space-y-4">
          {inbox.length === 0 ? (
            <EmptyState
              title="Inbox is empty"
              body="When your manager adds a todo or review on the secret link, it lands here."
            />
          ) : (
            inbox.map((item) => (
              <Card key={item.id}>
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      <Badge
                        variant={
                          item.status === "new" ? "default" : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    {item.notes ? (
                      <CardDescription className="mt-2 whitespace-pre-wrap">
                        {item.notes}
                      </CardDescription>
                    ) : null}
                    {item.page_url ? (
                      <a
                        href={item.page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-foreground underline underline-offset-4"
                      >
                        {item.page_url}
                      </a>
                    ) : null}
                    {item.screenshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.screenshot_url}
                        alt="Review screenshot"
                        className="mt-3 max-h-48 rounded-md border border-border object-contain"
                      />
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </CardHeader>
                {item.status === "new" ? (
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyClaudePrompt(item)}
                    >
                      {promptCopiedId === item.id
                        ? "Prompt copied"
                        : "Plan with Claude"}
                    </Button>
                    <Dialog
                      open={openPromoteId === item.id}
                      onOpenChange={(open) => {
                        if (open) openPromote(item);
                        else setOpenPromoteId(null);
                      }}
                    >
                      <DialogTrigger
                        render={
                          <Button size="sm">Promote / paste plan</Button>
                        }
                      />
                      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Promote to plan + tasks</DialogTitle>
                          <DialogDescription>
                            Paste Claude’s plan output, or fill the fields
                            manually. Marks this inbox item planned.
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          className="space-y-4"
                          action={(fd) => {
                            startTransition(async () => {
                              const result = await promoteInboxAction(fd);
                              if (result?.error) {
                                setPromoteError(result.error);
                                return;
                              }
                              setOpenPromoteId(null);
                            });
                          }}
                        >
                          <input
                            type="hidden"
                            name="inboxItemId"
                            value={item.id}
                          />
                          <div className="space-y-2">
                            <Label htmlFor={`claude-paste-${item.id}`}>
                              Paste Claude plan (optional)
                            </Label>
                            <Textarea
                              id={`claude-paste-${item.id}`}
                              name="claudePaste"
                              value={claudePaste}
                              onChange={(e) => applyClaudePaste(e.target.value)}
                              placeholder={
                                '{\n  "title": "…",\n  "summary": "…",\n  "tasks": ["…"]\n}'
                              }
                              rows={6}
                              className="font-mono text-xs"
                            />
                            <p className="text-xs text-muted-foreground">
                              Tip: use Plan with Claude first, run /superpowers
                              in Cursor, then paste the JSON back here.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`plan-title-${item.id}`}>
                              Plan title
                            </Label>
                            <Input
                              id={`plan-title-${item.id}`}
                              name="planTitle"
                              value={planTitle}
                              onChange={(e) => setPlanTitle(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`plan-summary-${item.id}`}>
                              Summary
                            </Label>
                            <Textarea
                              id={`plan-summary-${item.id}`}
                              name="planSummary"
                              value={planSummary}
                              onChange={(e) => setPlanSummary(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`tasks-${item.id}`}>
                              Tasks (one per line)
                            </Label>
                            <Textarea
                              id={`tasks-${item.id}`}
                              name="tasks"
                              value={planTasks}
                              onChange={(e) => setPlanTasks(e.target.value)}
                              placeholder={
                                "Investigate issue\nShip fix\nVerify on live"
                              }
                              rows={5}
                              required={!claudePaste.trim()}
                            />
                          </div>
                          {promoteError ? (
                            <p className="text-sm text-destructive">
                              {promoteError}
                            </p>
                          ) : null}
                          <Button type="submit" disabled={pending}>
                            {pending ? "Creating…" : "Create plan"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        startTransition(() =>
                          updateInboxStatusAction(item.id, "dismissed"),
                        )
                      }
                    >
                      Dismiss
                    </Button>
                  </CardContent>
                ) : null}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="plans" className="mt-4 space-y-4">
          {plans.length === 0 ? (
            <EmptyState
              title="No plans yet"
              body="Promote an inbox item to create a plan with tasks."
            />
          ) : (
            plans.map((plan) => {
              const planTasksList = tasks.filter((t) => t.plan_id === plan.id);
              const breakdown = countForPlan(tasks, plan.id);
              const total =
                breakdown.ready +
                breakdown.doing +
                breakdown.done +
                breakdown.blocked;
              return (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{plan.status}</Badge>
                      <Badge variant="secondary">
                        {breakdown.done}/{total} done
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{plan.title}</CardTitle>
                    {plan.summary ? (
                      <CardDescription className="whitespace-pre-wrap">
                        {plan.summary}
                      </CardDescription>
                    ) : null}
                    <StatusBreakdown counts={breakdown} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {(["draft", "active", "done"] as const).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={
                            plan.status === status ? "default" : "outline"
                          }
                          onClick={() =>
                            startTransition(() =>
                              updatePlanStatusAction(plan.id, status),
                            )
                          }
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                    {planTasksList.length > 0 ? (
                      <ul className="space-y-2 border-t border-border pt-3">
                        {planTasksList.map((task) => (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span>{task.title}</span>
                            <Badge variant="secondary">{task.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add standalone task</CardTitle>
              <CardDescription>
                Optional quick capture outside a plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                action={(fd) => {
                  startTransition(() => {
                    void createStandaloneTaskAction(fd);
                  });
                }}
              >
                <Input
                  name="title"
                  placeholder="Task title"
                  required
                  className="sm:flex-1"
                />
                <Button type="submit" disabled={pending}>
                  Add task
                </Button>
              </form>
            </CardContent>
          </Card>

          {TASK_STATUSES.map((status) => {
            const column = tasks.filter((t) => t.status === status);
            return (
              <section key={status} className="space-y-2">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {status} ({column.length})
                </h2>
                {column.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None</p>
                ) : (
                  column.map((task) => {
                    const plan = plans.find((p) => p.id === task.plan_id);
                    return (
                      <Card key={task.id}>
                        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {plan ? (
                              <p className="text-xs text-muted-foreground">
                                Plan: {plan.title}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Standalone
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {TASK_STATUSES.map((next) => (
                              <Button
                                key={next}
                                size="sm"
                                variant={
                                  task.status === next ? "default" : "outline"
                                }
                                onClick={() =>
                                  startTransition(() =>
                                    updateTaskStatusAction(task.id, next),
                                  )
                                }
                              >
                                {next}
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </section>
            );
          })}
        </TabsContent>
      </Tabs>

      <p className="pb-8 text-xs text-muted-foreground">
        Manager path: <code className="rounded bg-muted px-1">{managerPath}</code>
        {" · "}
        API: <code className="rounded bg-muted px-1">POST /api/plans</code>
      </p>
    </div>
  );
}

function ReadyColumn({
  title,
  empty,
  tasks,
  plans,
  pending,
  highlight,
  onStatus,
}: {
  title: string;
  empty: string;
  tasks: Task[];
  plans: Plan[];
  pending: boolean;
  highlight?: boolean;
  onStatus: (id: string, status: (typeof TASK_STATUSES)[number]) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p
          className={`rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground ${
            highlight ? "border-foreground/20 bg-muted/40" : "border-border"
          }`}
        >
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const plan = plans.find((p) => p.id === task.plan_id);
            return (
              <li
                key={task.id}
                className={`rounded-lg border bg-card px-4 py-3 ${
                  highlight ? "border-foreground/25" : "border-border"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan ? plan.title : "Standalone"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {TASK_STATUSES.map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        disabled={pending}
                        variant={task.status === next ? "default" : "outline"}
                        onClick={() => onStatus(task.id, next)}
                      >
                        {next}
                      </Button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StatusBreakdown({ counts }: { counts: TaskCounts }) {
  const total = counts.ready + counts.doing + counts.done + counts.blocked;
  if (total === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">No tasks yet</p>
    );
  }
  const segments: { key: keyof TaskCounts; label: string; className: string }[] =
    [
      { key: "done", label: "Done", className: "bg-foreground" },
      { key: "doing", label: "Doing", className: "bg-foreground/70" },
      { key: "ready", label: "Ready", className: "bg-foreground/35" },
      { key: "blocked", label: "Blocked", className: "bg-muted-foreground/40" },
    ];
  return (
    <div className="mt-3 space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
