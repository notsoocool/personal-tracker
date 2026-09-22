"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  createStandaloneTaskAction,
  logoutAction,
  promoteInboxAction,
  regenerateLinkAction,
  updateInboxStatusAction,
  updatePlanStatusAction,
  updateTaskPlatformAction,
  updateTaskStatusAction,
} from "@/lib/actions";
import {
  buildClaudePlanPrompt,
  parseClaudePlanOutput,
} from "@/lib/claude-handoff";
import type {
  InboxItem,
  Plan,
  Task,
  TaskCounts,
  WorkPlatform,
} from "@/lib/types";
import { PlatformChip, PlatformPicker } from "@/components/platform-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
type PlatformFilter = "all" | WorkPlatform;

function countForPlan(tasks: Task[], planId: string): TaskCounts {
  const counts: TaskCounts = { ready: 0, doing: 0, done: 0, blocked: 0 };
  for (const t of tasks) {
    if (t.plan_id === planId) counts[t.status] += 1;
  }
  return counts;
}

function inboxForPlan(
  plans: Plan[],
  inbox: InboxItem[],
  planId: string | null,
): InboxItem | null {
  if (!planId) return null;
  const plan = plans.find((p) => p.id === planId);
  if (!plan?.source_inbox_item_id) return null;
  return inbox.find((i) => i.id === plan.source_inbox_item_id) ?? null;
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
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [openPromoteId, setOpenPromoteId] = useState<string | null>(null);
  const [claudePaste, setClaudePaste] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planSummary, setPlanSummary] = useState("");
  const [planTasks, setPlanTasks] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [view, setView] = useState<"today" | "inbox" | "plans" | "tasks">(
    "today",
  );

  const newInbox = inbox.filter((i) => i.status === "new");

  const filteredTasks = useMemo(() => {
    if (platformFilter === "all") return tasks;
    return tasks.filter((t) => t.work_platform === platformFilter);
  }, [tasks, platformFilter]);

  const readyTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "ready"),
    [filteredTasks],
  );
  const doingTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "doing"),
    [filteredTasks],
  );
  const blockedTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "blocked"),
    [filteredTasks],
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function copyLink() {
    const url = `${window.location.origin}${managerPath}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      showToast("Manager link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyPlanPrompt(item: InboxItem) {
    const prompt = buildClaudePlanPrompt(
      item,
      projectName,
      window.location.origin,
    );
    void navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopiedId(item.id);
      showToast("Plan this prompt copied — paste in Cursor or Claude");
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
          ? "Could not parse yet — paste full JSON with title, summary, tasks[]."
          : null,
      );
      return;
    }
    setPromoteError(null);
    setPlanTitle(parsed.title);
    setPlanSummary(parsed.summary);
    setPlanTasks(parsed.tasks.join("\n"));
  }

  function setPlatform(taskId: string, platform: WorkPlatform | null) {
    startTransition(() => updateTaskPlatformAction(taskId, platform));
  }

  function setStatus(taskId: string, status: (typeof TASK_STATUSES)[number]) {
    startTransition(() => updateTaskStatusAction(taskId, status));
  }

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="enter-up glass-panel flex flex-col gap-4 rounded-2xl px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan">
            Personal Tracker
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-glow sm:text-4xl">
            Today
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Active project{" "}
            <span className="font-medium text-ice">{projectName}</span>
            {" · "}
            triage → plan → execute
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            {copied ? "Copied" : "Copy manager link"}
          </Button>
          <form action={regenerateLinkAction}>
            <Button type="submit" variant="ghost" size="sm">
              Regenerate
            </Button>
          </form>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <nav className="enter-up enter-up-delay-1 flex flex-wrap gap-2">
        {(
          [
            ["today", "Today"],
            ["inbox", `Inbox${newInbox.length ? ` (${newInbox.length})` : ""}`],
            ["plans", "Plans"],
            ["tasks", "Tasks"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={view === key ? "default" : "outline"}
            onClick={() => setView(key)}
          >
            {label}
          </Button>
        ))}
      </nav>

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

      {view === "today" ? (
        <div className="enter-up enter-up-delay-3 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              One screen for what needs a plan, what you’re on, and what’s next.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["cursor", "Cursor"],
                  ["claude", "Claude"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="xs"
                  variant={platformFilter === key ? "default" : "outline"}
                  onClick={() => setPlatformFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <TodaySection
            title="Needs triage"
            count={newInbox.length}
            empty="Inbox is clear. When your manager drops a todo or review, it shows up here."
            delay="enter-up-delay-1"
            accent
          >
            {newInbox.map((item) => (
              <TriageCard
                key={item.id}
                item={item}
                pending={pending}
                promptCopied={promptCopiedId === item.id}
                promoteOpen={openPromoteId === item.id}
                promoteError={promoteError}
                claudePaste={claudePaste}
                planTitle={planTitle}
                planSummary={planSummary}
                planTasks={planTasks}
                onCopyPrompt={() => copyPlanPrompt(item)}
                onPromoteOpenChange={(open) => {
                  if (open) openPromote(item);
                  else setOpenPromoteId(null);
                }}
                onPaste={applyClaudePaste}
                onTitle={setPlanTitle}
                onSummary={setPlanSummary}
                onTasks={setPlanTasks}
                onDismiss={() =>
                  startTransition(() =>
                    updateInboxStatusAction(item.id, "dismissed"),
                  )
                }
                onPromote={(fd) => {
                  startTransition(async () => {
                    const result = await promoteInboxAction(fd);
                    if (result?.error) {
                      setPromoteError(result.error);
                      return;
                    }
                    setOpenPromoteId(null);
                    showToast("Plan created — tasks are in Up next");
                    setView("today");
                  });
                }}
              />
            ))}
          </TodaySection>

          <TodaySection
            title="Doing now"
            count={doingTasks.length}
            empty="Nothing in progress. Start something from Up next."
            delay="enter-up-delay-2"
          >
            {doingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                plan={plans.find((p) => p.id === task.plan_id)}
                review={inboxForPlan(plans, inbox, task.plan_id)}
                pending={pending}
                onStatus={setStatus}
                onPlatform={setPlatform}
                primary="done"
              />
            ))}
          </TodaySection>

          <TodaySection
            title="Up next"
            count={readyTasks.length}
            empty="No ready tasks. Plan an inbox item or unblock work."
            delay="enter-up-delay-3"
          >
            {readyTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                plan={plans.find((p) => p.id === task.plan_id)}
                review={inboxForPlan(plans, inbox, task.plan_id)}
                pending={pending}
                onStatus={setStatus}
                onPlatform={setPlatform}
                primary="start"
              />
            ))}
          </TodaySection>

          <TodaySection
            title="Blocked"
            count={blockedTasks.length}
            empty="Nothing blocked."
            delay="enter-up-delay-4"
          >
            {blockedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                plan={plans.find((p) => p.id === task.plan_id)}
                review={inboxForPlan(plans, inbox, task.plan_id)}
                pending={pending}
                onStatus={setStatus}
                onPlatform={setPlatform}
              />
            ))}
          </TodaySection>
        </div>
      ) : null}

      {view === "inbox" ? (
        <div className="enter-up space-y-4">
          {inbox.length === 0 ? (
            <EmptyState
              title="Inbox is empty"
              body="When your manager adds a todo or review on the secret link, it lands here."
            />
          ) : (
            inbox.map((item) => (
              <article key={item.id} className="glass-panel rounded-2xl p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.type}</Badge>
                  <Badge
                    variant={item.status === "new" ? "default" : "secondary"}
                  >
                    {item.status}
                  </Badge>
                </div>
                <h3 className="font-display text-lg font-semibold">
                  {item.title}
                </h3>
                <ReviewContext item={item} />
                {item.status === "new" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="pulse-plan"
                      onClick={() => copyPlanPrompt(item)}
                    >
                      {promptCopiedId === item.id
                        ? "Prompt copied"
                        : "Plan this"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPromote(item)}
                    >
                      Paste plan back
                    </Button>
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
                  </div>
                ) : null}
              </article>
            ))
          )}
          <PromoteDialog
            item={
              openPromoteId
                ? (inbox.find((i) => i.id === openPromoteId) ?? null)
                : null
            }
            open={!!openPromoteId}
            onOpenChange={(open) => {
              if (!open) setOpenPromoteId(null);
            }}
            pending={pending}
            promoteError={promoteError}
            claudePaste={claudePaste}
            planTitle={planTitle}
            planSummary={planSummary}
            planTasks={planTasks}
            onPaste={applyClaudePaste}
            onTitle={setPlanTitle}
            onSummary={setPlanSummary}
            onTasks={setPlanTasks}
            onPromote={(fd) => {
              startTransition(async () => {
                const result = await promoteInboxAction(fd);
                if (result?.error) {
                  setPromoteError(result.error);
                  return;
                }
                setOpenPromoteId(null);
                showToast("Plan created");
              });
            }}
          />
        </div>
      ) : null}

      {view === "plans" ? (
        <div className="enter-up space-y-4">
          {plans.length === 0 ? (
            <EmptyState
              title="No plans yet"
              body="Use Plan this on an inbox item, then paste the JSON back."
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
              const source = plan.source_inbox_item_id
                ? inbox.find((i) => i.id === plan.source_inbox_item_id)
                : null;
              return (
                <article key={plan.id} className="glass-panel rounded-2xl p-5">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{plan.status}</Badge>
                    <Badge variant="secondary">
                      {breakdown.done}/{total} done
                    </Badge>
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    {plan.title}
                  </h3>
                  {plan.summary ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {plan.summary}
                    </p>
                  ) : null}
                  {source ? <ReviewContext item={source} compact /> : null}
                  <StatusBreakdown counts={breakdown} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["draft", "active", "done"] as const).map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={plan.status === status ? "default" : "outline"}
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
                    <ul className="mt-4 space-y-2 border-t border-border/50 pt-3">
                      {planTasksList.map((task) => (
                        <li
                          key={task.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span>{task.title}</span>
                          <div className="flex items-center gap-2">
                            <PlatformChip platform={task.work_platform} />
                            <Badge variant="secondary">{task.status}</Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {view === "tasks" ? (
        <div className="enter-up space-y-4">
          <article className="glass-panel rounded-2xl p-5">
            <h3 className="font-display text-base font-semibold">
              Add standalone task
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Quick capture outside a plan.
            </p>
            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
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
          </article>

          {TASK_STATUSES.map((status) => {
            const column = tasks.filter((t) => t.status === status);
            return (
              <section key={status} className="space-y-2">
                <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {status} ({column.length})
                </h2>
                {column.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None</p>
                ) : (
                  column.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      plan={plans.find((p) => p.id === task.plan_id)}
                      review={inboxForPlan(plans, inbox, task.plan_id)}
                      pending={pending}
                      onStatus={setStatus}
                      onPlatform={setPlatform}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      <p className="pb-8 text-xs text-muted-foreground">
        Manager path:{" "}
        <code className="rounded bg-muted/60 px-1">{managerPath}</code>
        {" · "}
        API: <code className="rounded bg-muted/60 px-1">POST /api/plans</code>
      </p>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-cyan/40 bg-[oklch(0.18_0.04_240/90%)] px-4 py-2 text-sm text-ice shadow-[0_0_32px_oklch(0.78_0.14_210/25%)] backdrop-blur"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function TodaySection({
  title,
  count,
  empty,
  children,
  delay,
  accent,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
  delay?: string;
  accent?: boolean;
}) {
  return (
    <section className={`space-y-3 ${delay ?? ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold tracking-wide">
          {title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p
          className={`rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground ${
            accent
              ? "border-cyan/30 bg-cyan/5"
              : "border-border/60 bg-muted/20"
          }`}
        >
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  );
}

function TriageCard({
  item,
  pending,
  promptCopied,
  promoteOpen,
  promoteError,
  claudePaste,
  planTitle,
  planSummary,
  planTasks,
  onCopyPrompt,
  onPromoteOpenChange,
  onPaste,
  onTitle,
  onSummary,
  onTasks,
  onDismiss,
  onPromote,
}: {
  item: InboxItem;
  pending: boolean;
  promptCopied: boolean;
  promoteOpen: boolean;
  promoteError: string | null;
  claudePaste: string;
  planTitle: string;
  planSummary: string;
  planTasks: string;
  onCopyPrompt: () => void;
  onPromoteOpenChange: (open: boolean) => void;
  onPaste: (raw: string) => void;
  onTitle: (v: string) => void;
  onSummary: (v: string) => void;
  onTasks: (v: string) => void;
  onDismiss: () => void;
  onPromote: (fd: FormData) => void;
}) {
  return (
    <li className="glass-panel glass-panel-hover rounded-2xl p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{item.type}</Badge>
        <Badge>new</Badge>
      </div>
      <h3 className="font-display text-lg font-semibold">{item.title}</h3>
      <ReviewContext item={item} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" className="pulse-plan" onClick={onCopyPrompt}>
          {promptCopied ? "Prompt copied" : "Plan this"}
        </Button>
        <Dialog open={promoteOpen} onOpenChange={onPromoteOpenChange}>
          <DialogTrigger
            render={<Button size="sm" variant="outline">Paste plan back</Button>}
          />
          <PromoteDialogBody
            item={item}
            pending={pending}
            promoteError={promoteError}
            claudePaste={claudePaste}
            planTitle={planTitle}
            planSummary={planSummary}
            planTasks={planTasks}
            onPaste={onPaste}
            onTitle={onTitle}
            onSummary={onSummary}
            onTasks={onTasks}
            onPromote={onPromote}
          />
        </Dialog>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}

function PromoteDialog({
  item,
  open,
  onOpenChange,
  pending,
  promoteError,
  claudePaste,
  planTitle,
  planSummary,
  planTasks,
  onPaste,
  onTitle,
  onSummary,
  onTasks,
  onPromote,
}: {
  item: InboxItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  promoteError: string | null;
  claudePaste: string;
  planTitle: string;
  planSummary: string;
  planTasks: string;
  onPaste: (raw: string) => void;
  onTitle: (v: string) => void;
  onSummary: (v: string) => void;
  onTasks: (v: string) => void;
  onPromote: (fd: FormData) => void;
}) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PromoteDialogBody
        item={item}
        pending={pending}
        promoteError={promoteError}
        claudePaste={claudePaste}
        planTitle={planTitle}
        planSummary={planSummary}
        planTasks={planTasks}
        onPaste={onPaste}
        onTitle={onTitle}
        onSummary={onSummary}
        onTasks={onTasks}
        onPromote={onPromote}
      />
    </Dialog>
  );
}

function PromoteDialogBody({
  item,
  pending,
  promoteError,
  claudePaste,
  planTitle,
  planSummary,
  planTasks,
  onPaste,
  onTitle,
  onSummary,
  onTasks,
  onPromote,
}: {
  item: InboxItem;
  pending: boolean;
  promoteError: string | null;
  claudePaste: string;
  planTitle: string;
  planSummary: string;
  planTasks: string;
  onPaste: (raw: string) => void;
  onTitle: (v: string) => void;
  onSummary: (v: string) => void;
  onTasks: (v: string) => void;
  onPromote: (fd: FormData) => void;
}) {
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-cyan/20 bg-[oklch(0.16_0.04_240/95%)] sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Paste plan back</DialogTitle>
        <DialogDescription>
          After /superpowers in Cursor or Claude, paste the JSON here. Marks
          this inbox item planned.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        action={(fd) => {
          onPromote(fd);
        }}
      >
        <input type="hidden" name="inboxItemId" value={item.id} />
        <div className="space-y-2">
          <Label htmlFor={`claude-paste-${item.id}`}>
            Paste plan JSON (optional)
          </Label>
          <Textarea
            id={`claude-paste-${item.id}`}
            name="claudePaste"
            value={claudePaste}
            onChange={(e) => onPaste(e.target.value)}
            placeholder={
              '{\n  "title": "…",\n  "summary": "…",\n  "tasks": ["…"]\n}'
            }
            rows={6}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Tip: Plan this → run in Cursor or Claude → paste JSON → Create plan.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`plan-title-${item.id}`}>Plan title</Label>
          <Input
            id={`plan-title-${item.id}`}
            name="planTitle"
            value={planTitle}
            onChange={(e) => onTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`plan-summary-${item.id}`}>Summary</Label>
          <Textarea
            id={`plan-summary-${item.id}`}
            name="planSummary"
            value={planSummary}
            onChange={(e) => onSummary(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tasks-${item.id}`}>Tasks (one per line)</Label>
          <Textarea
            id={`tasks-${item.id}`}
            name="tasks"
            value={planTasks}
            onChange={(e) => onTasks(e.target.value)}
            placeholder={"Investigate issue\nShip fix\nVerify on live"}
            rows={5}
            required={!claudePaste.trim()}
          />
        </div>
        {promoteError ? (
          <p className="text-sm text-destructive" role="alert">
            {promoteError}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create plan"}
        </Button>
      </form>
    </DialogContent>
  );
}

function TaskCard({
  task,
  plan,
  review,
  pending,
  onStatus,
  onPlatform,
  primary,
}: {
  task: Task;
  plan?: Plan;
  review?: InboxItem | null;
  pending: boolean;
  onStatus: (id: string, status: (typeof TASK_STATUSES)[number]) => void;
  onPlatform: (id: string, platform: WorkPlatform | null) => void;
  primary?: "start" | "done";
}) {
  return (
    <li className="glass-panel glass-panel-hover rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformChip platform={task.work_platform} />
            <Badge variant="secondary" className="status-morph capitalize">
              {task.status}
            </Badge>
          </div>
          <p className="font-medium">{task.title}</p>
          <p className="text-xs text-muted-foreground">
            {plan ? plan.title : "Standalone"}
          </p>
          {review ? <ReviewContext item={review} compact /> : null}
          <PlatformPicker
            value={task.work_platform}
            disabled={pending}
            onChange={(next) => onPlatform(task.id, next)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {primary === "start" ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onStatus(task.id, "doing")}
            >
              Start
            </Button>
          ) : null}
          {primary === "done" ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onStatus(task.id, "done")}
            >
              Done
            </Button>
          ) : null}
          {TASK_STATUSES.map((next) => (
            <Button
              key={next}
              size="xs"
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
}

function ReviewContext({
  item,
  compact,
}: {
  item: InboxItem;
  compact?: boolean;
}) {
  if (!item.notes && !item.page_url && !item.screenshot_url) return null;
  return (
    <div className={compact ? "mt-2 space-y-2" : "mt-3 space-y-2"}>
      {item.notes ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {item.notes}
        </p>
      ) : null}
      {item.page_url ? (
        <a
          href={item.page_url}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm text-cyan underline underline-offset-4"
        >
          {item.page_url}
        </a>
      ) : null}
      {item.screenshot_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.screenshot_url}
          alt="Review screenshot"
          className={`rounded-lg border border-cyan/20 object-contain ${
            compact ? "max-h-28" : "max-h-48"
          }`}
        />
      ) : null}
    </div>
  );
}

function StatusBreakdown({ counts }: { counts: TaskCounts }) {
  const total = counts.ready + counts.doing + counts.done + counts.blocked;
  if (total === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">No tasks yet</p>;
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
    <div className="rounded-2xl border border-dashed border-cyan/25 bg-cyan/5 px-6 py-10 text-center">
      <p className="font-display font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
