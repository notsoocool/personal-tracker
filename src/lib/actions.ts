"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearOwnerSession,
  createOwnerSession,
  isOwnerAuthenticated,
  passwordsMatch,
} from "./auth";
import {
  createInboxItem,
  createTask,
  getActiveManagerLink,
  getActiveProject,
  getInboxItem,
  getManagerLinkByToken,
  promoteInboxToPlan,
  regenerateManagerLink,
  saveUpload,
  updateInboxStatus,
  updatePlanStatus,
  updateTaskStatus,
} from "./db";
import type { InboxStatus, PlanStatus, TaskStatus } from "./types";

async function requireOwner() {
  if (!(await isOwnerAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (!passwordsMatch(password)) {
    return { error: "Wrong password" };
  }
  await createOwnerSession();
  redirect("/cockpit");
}

export async function logoutAction() {
  await clearOwnerSession();
  redirect("/login");
}

export async function regenerateLinkAction() {
  await requireOwner();
  regenerateManagerLink();
  revalidatePath("/cockpit");
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  await requireOwner();
  updateTaskStatus(taskId, status);
  revalidatePath("/cockpit");
  revalidatePath("/m", "layout");
}

export async function updatePlanStatusAction(planId: string, status: PlanStatus) {
  await requireOwner();
  updatePlanStatus(planId, status);
  revalidatePath("/cockpit");
  revalidatePath("/m", "layout");
}

export async function updateInboxStatusAction(
  inboxId: string,
  status: InboxStatus,
) {
  await requireOwner();
  updateInboxStatus(inboxId, status);
  revalidatePath("/cockpit");
  revalidatePath("/m", "layout");
}

export async function createStandaloneTaskAction(formData: FormData) {
  await requireOwner();
  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Title required" };
  const project = getActiveProject();
  createTask({ projectId: project.id, title });
  revalidatePath("/cockpit");
  revalidatePath("/m", "layout");
}

export async function promoteInboxAction(formData: FormData) {
  await requireOwner();
  const inboxItemId = String(formData.get("inboxItemId") || "");
  const planTitle = String(formData.get("planTitle") || "").trim();
  const planSummary = String(formData.get("planSummary") || "").trim();
  const tasksRaw = String(formData.get("tasks") || "");
  const taskTitles = tasksRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!inboxItemId || !planTitle) {
    return { error: "Plan title is required" };
  }
  if (taskTitles.length === 0) {
    return { error: "Add at least one task (one per line)" };
  }

  const item = getInboxItem(inboxItemId);
  if (!item) return { error: "Inbox item not found" };

  promoteInboxToPlan({
    inboxItemId,
    planTitle,
    planSummary: planSummary || undefined,
    taskTitles,
  });

  revalidatePath("/cockpit");
  revalidatePath("/m", "layout");
  return { ok: true };
}

export async function managerAddTodoAction(token: string, formData: FormData) {
  const link = getManagerLinkByToken(token);
  if (!link) return { error: "Invalid or revoked link" };

  const title = String(formData.get("title") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  if (!title) return { error: "Title required" };

  createInboxItem({
    projectId: link.project_id,
    type: "todo",
    title,
    notes: notes || null,
  });

  revalidatePath(`/m/${token}`);
  revalidatePath("/cockpit");
  return { ok: true };
}

export async function managerAddReviewAction(token: string, formData: FormData) {
  const link = getManagerLinkByToken(token);
  if (!link) return { error: "Invalid or revoked link" };

  const title = String(formData.get("title") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const pageUrl = String(formData.get("pageUrl") || "").trim();
  const file = formData.get("screenshot");

  if (!title) return { error: "Title required" };
  if (!pageUrl) return { error: "Page URL required" };

  let screenshotUrl: string | null = null;
  if (file && file instanceof File && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    screenshotUrl = saveUpload(file.name || "screenshot.png", bytes);
  }

  createInboxItem({
    projectId: link.project_id,
    type: "review",
    title,
    notes: notes || null,
    pageUrl,
    screenshotUrl,
  });

  revalidatePath(`/m/${token}`);
  revalidatePath("/cockpit");
  return { ok: true };
}

export async function getManagerUrlPath() {
  await requireOwner();
  const link = getActiveManagerLink();
  return `/m/${link.token}`;
}
