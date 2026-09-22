"use client";

import { useState, useTransition } from "react";
import { managerAddReviewAction, managerAddTodoAction } from "@/lib/actions";
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

type Props = {
  token: string;
  projectName: string;
  inbox: InboxItem[];
  plans: Plan[];
  tasks: Task[];
  counts: TaskCounts;
};

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

  const openInbox = inbox.filter((i) => i.status === "new");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="border-b border-border pb-6">
        <p className="text-sm font-medium text-muted-foreground">
          Manager link
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {projectName} progress
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop todos and reviews. Watch Ready / Doing / Done update as work
          moves.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <Tabs defaultValue="todo">
        <TabsList>
          <TabsTrigger value="todo">Add todo</TabsTrigger>
          <TabsTrigger value="review">Add review</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="todo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add a todo</CardTitle>
              <CardDescription>
                Lands in the owner inbox for {projectName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
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
                    (document.getElementById("todo-form") as HTMLFormElement | null)?.reset();
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add a review</CardTitle>
              <CardDescription>
                Include the exact page URL on the live site. Screenshot optional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                encType="multipart/form-data"
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
                    (document.getElementById("review-form") as HTMLFormElement | null)?.reset();
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Open inbox</CardTitle>
              <CardDescription>
                Items waiting for the owner to plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {openInbox.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No open inbox items.
                </p>
              ) : (
                openInbox.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <div className="mb-1 flex gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      <Badge variant="secondary">{item.status}</Badge>
                    </div>
                    <p className="font-medium">{item.title}</p>
                    {item.page_url ? (
                      <a
                        href={item.page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline underline-offset-4"
                      >
                        {item.page_url}
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No plans yet.</p>
              ) : (
                plans.map((plan) => {
                  const planTasks = tasks.filter((t) => t.plan_id === plan.id);
                  return (
                    <div
                      key={plan.id}
                      className="rounded-md border border-border px-3 py-3"
                    >
                      <div className="mb-1 flex flex-wrap gap-2">
                        <Badge variant="outline">{plan.status}</Badge>
                        <Badge variant="secondary">
                          {planTasks.filter((t) => t.status === "done").length}/
                          {planTasks.length} done
                        </Badge>
                      </div>
                      <p className="font-medium">{plan.title}</p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {planTasks.map((task) => (
                          <li key={task.id} className="flex justify-between gap-2">
                            <span>{task.title}</span>
                            <span className="shrink-0 capitalize">
                              {task.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
