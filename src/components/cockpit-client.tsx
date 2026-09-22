"use client";

import { useState, useTransition } from "react";
import {
  createStandaloneTaskAction,
  logoutAction,
  promoteInboxAction,
  regenerateLinkAction,
  updateInboxStatusAction,
  updatePlanStatusAction,
  updateTaskStatusAction,
} from "@/lib/actions";
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

export function CockpitClient({
  projectName,
  managerPath,
  inbox,
  plans,
  tasks,
  counts,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [openPromoteId, setOpenPromoteId] = useState<string | null>(null);

  const newInbox = inbox.filter((i) => i.status === "new");

  function copyLink() {
    const url = `${window.location.origin}${managerPath}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

      <Tabs defaultValue="inbox">
        <TabsList>
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
                    <Dialog
                      open={openPromoteId === item.id}
                      onOpenChange={(open) => {
                        setOpenPromoteId(open ? item.id : null);
                        setPromoteError(null);
                      }}
                    >
                      <DialogTrigger
                        render={<Button size="sm">Promote to plan</Button>}
                      />
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Promote to plan + tasks</DialogTitle>
                          <DialogDescription>
                            Turn this inbox item into an active plan with child
                            tasks for {projectName}.
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
                            <Label htmlFor={`plan-title-${item.id}`}>
                              Plan title
                            </Label>
                            <Input
                              id={`plan-title-${item.id}`}
                              name="planTitle"
                              defaultValue={item.title}
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
                              defaultValue={item.notes ?? ""}
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
                              placeholder={"Investigate issue\nShip fix\nVerify on live"}
                              rows={5}
                              required
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
              const planTasks = tasks.filter((t) => t.plan_id === plan.id);
              return (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{plan.status}</Badge>
                      <Badge variant="secondary">
                        {planTasks.length} task
                        {planTasks.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{plan.title}</CardTitle>
                    {plan.summary ? (
                      <CardDescription className="whitespace-pre-wrap">
                        {plan.summary}
                      </CardDescription>
                    ) : null}
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
                    {planTasks.length > 0 ? (
                      <ul className="space-y-2 border-t border-border pt-3">
                        {planTasks.map((task) => (
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
      </p>
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
