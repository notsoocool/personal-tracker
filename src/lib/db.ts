import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import type {
  InboxItem,
  InboxStatus,
  InboxType,
  ManagerLink,
  Plan,
  PlanStatus,
  Project,
  Task,
  TaskCounts,
  TaskStatus,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tracker.sqlite");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

let db: Database.Database | null = null;

function id() {
  return randomBytes(12).toString("hex");
}

function now() {
  return new Date().toISOString();
}

export function getDb() {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      page_url TEXT,
      screenshot_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      summary TEXT,
      source_inbox_item_id TEXT REFERENCES inbox_items(id),
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      plan_id TEXT REFERENCES plans(id),
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'ready',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manager_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );
  `);

  seedIfEmpty(db);
  return db;
}

function seedIfEmpty(database: Database.Database) {
  const row = database.prepare("SELECT COUNT(*) AS c FROM projects").get() as {
    c: number;
  };
  if (row.c > 0) return;

  const projectId = id();
  const token = randomBytes(24).toString("hex");

  database
    .prepare("INSERT INTO projects (id, name, is_active) VALUES (?, ?, 1)")
    .run(projectId, "Flit");

  database
    .prepare(
      "INSERT INTO manager_links (id, project_id, token, created_at, revoked_at) VALUES (?, ?, ?, ?, NULL)",
    )
    .run(id(), projectId, token, now());
}

export function getActiveProject(): Project {
  const project = getDb()
    .prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1")
    .get() as Project | undefined;
  if (!project) throw new Error("No active project");
  return project;
}

export function getProject(idValue: string): Project | null {
  return (
    (getDb().prepare("SELECT * FROM projects WHERE id = ?").get(idValue) as
      | Project
      | undefined) ?? null
  );
}

export function getActiveManagerLink(): ManagerLink {
  const project = getActiveProject();
  const link = getDb()
    .prepare(
      "SELECT * FROM manager_links WHERE project_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
    )
    .get(project.id) as ManagerLink | undefined;
  if (!link) throw new Error("No active manager link");
  return link;
}

export function getManagerLinkByToken(token: string): ManagerLink | null {
  return (
    (getDb()
      .prepare(
        "SELECT * FROM manager_links WHERE token = ? AND revoked_at IS NULL",
      )
      .get(token) as ManagerLink | undefined) ?? null
  );
}

export function regenerateManagerLink(): ManagerLink {
  const project = getActiveProject();
  const database = getDb();
  const tx = database.transaction(() => {
    database
      .prepare(
        "UPDATE manager_links SET revoked_at = ? WHERE project_id = ? AND revoked_at IS NULL",
      )
      .run(now(), project.id);
    const link: ManagerLink = {
      id: id(),
      project_id: project.id,
      token: randomBytes(24).toString("hex"),
      created_at: now(),
      revoked_at: null,
    };
    database
      .prepare(
        "INSERT INTO manager_links (id, project_id, token, created_at, revoked_at) VALUES (?, ?, ?, ?, NULL)",
      )
      .run(link.id, link.project_id, link.token, link.created_at);
    return link;
  });
  return tx();
}

export function listInbox(projectId: string, status?: InboxStatus): InboxItem[] {
  if (status) {
    return getDb()
      .prepare(
        "SELECT * FROM inbox_items WHERE project_id = ? AND status = ? ORDER BY created_at DESC",
      )
      .all(projectId, status) as InboxItem[];
  }
  return getDb()
    .prepare(
      "SELECT * FROM inbox_items WHERE project_id = ? ORDER BY created_at DESC",
    )
    .all(projectId) as InboxItem[];
}

export function getInboxItem(idValue: string): InboxItem | null {
  return (
    (getDb().prepare("SELECT * FROM inbox_items WHERE id = ?").get(idValue) as
      | InboxItem
      | undefined) ?? null
  );
}

export function createInboxItem(input: {
  projectId: string;
  type: InboxType;
  title: string;
  notes?: string | null;
  pageUrl?: string | null;
  screenshotUrl?: string | null;
}): InboxItem {
  const item: InboxItem = {
    id: id(),
    project_id: input.projectId,
    type: input.type,
    title: input.title,
    notes: input.notes ?? null,
    page_url: input.pageUrl ?? null,
    screenshot_url: input.screenshotUrl ?? null,
    status: "new",
    created_at: now(),
  };
  getDb()
    .prepare(
      `INSERT INTO inbox_items
        (id, project_id, type, title, notes, page_url, screenshot_url, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      item.id,
      item.project_id,
      item.type,
      item.title,
      item.notes,
      item.page_url,
      item.screenshot_url,
      item.status,
      item.created_at,
    );
  return item;
}

export function updateInboxStatus(idValue: string, status: InboxStatus) {
  getDb()
    .prepare("UPDATE inbox_items SET status = ? WHERE id = ?")
    .run(status, idValue);
}

export function listPlans(projectId: string): Plan[] {
  return getDb()
    .prepare(
      "SELECT * FROM plans WHERE project_id = ? ORDER BY created_at DESC",
    )
    .all(projectId) as Plan[];
}

export function createPlan(input: {
  projectId: string;
  title: string;
  summary?: string | null;
  sourceInboxItemId?: string | null;
  status?: PlanStatus;
}): Plan {
  const plan: Plan = {
    id: id(),
    project_id: input.projectId,
    title: input.title,
    summary: input.summary ?? null,
    source_inbox_item_id: input.sourceInboxItemId ?? null,
    status: input.status ?? "active",
    created_at: now(),
  };
  getDb()
    .prepare(
      `INSERT INTO plans
        (id, project_id, title, summary, source_inbox_item_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      plan.id,
      plan.project_id,
      plan.title,
      plan.summary,
      plan.source_inbox_item_id,
      plan.status,
      plan.created_at,
    );
  return plan;
}

export function updatePlanStatus(idValue: string, status: PlanStatus) {
  getDb()
    .prepare("UPDATE plans SET status = ? WHERE id = ?")
    .run(status, idValue);
}

export function listTasks(projectId: string, planId?: string | null): Task[] {
  if (planId) {
    return getDb()
      .prepare(
        "SELECT * FROM tasks WHERE project_id = ? AND plan_id = ? ORDER BY sort_order ASC, created_at ASC",
      )
      .all(projectId, planId) as Task[];
  }
  return getDb()
    .prepare(
      "SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .all(projectId) as Task[];
}

export function createTask(input: {
  projectId: string;
  planId?: string | null;
  title: string;
  notes?: string | null;
  status?: TaskStatus;
  sortOrder?: number;
}): Task {
  const task: Task = {
    id: id(),
    project_id: input.projectId,
    plan_id: input.planId ?? null,
    title: input.title,
    notes: input.notes ?? null,
    status: input.status ?? "ready",
    sort_order: input.sortOrder ?? 0,
    created_at: now(),
  };
  getDb()
    .prepare(
      `INSERT INTO tasks
        (id, project_id, plan_id, title, notes, status, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      task.id,
      task.project_id,
      task.plan_id,
      task.title,
      task.notes,
      task.status,
      task.sort_order,
      task.created_at,
    );
  return task;
}

export function updateTaskStatus(idValue: string, status: TaskStatus) {
  getDb()
    .prepare("UPDATE tasks SET status = ? WHERE id = ?")
    .run(status, idValue);
}

export function taskCounts(projectId: string): TaskCounts {
  const rows = getDb()
    .prepare(
      "SELECT status, COUNT(*) AS c FROM tasks WHERE project_id = ? GROUP BY status",
    )
    .all(projectId) as { status: TaskStatus; c: number }[];
  const counts: TaskCounts = { ready: 0, doing: 0, done: 0, blocked: 0 };
  for (const row of rows) counts[row.status] = row.c;
  return counts;
}

export function promoteInboxToPlan(input: {
  inboxItemId: string;
  planTitle: string;
  planSummary?: string;
  taskTitles: string[];
}): { plan: Plan; tasks: Task[] } {
  const item = getInboxItem(input.inboxItemId);
  if (!item) throw new Error("Inbox item not found");

  const database = getDb();
  const tx = database.transaction(() => {
    const plan = createPlan({
      projectId: item.project_id,
      title: input.planTitle,
      summary: input.planSummary ?? item.notes,
      sourceInboxItemId: item.id,
      status: "active",
    });
    const tasks = input.taskTitles
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title, index) =>
        createTask({
          projectId: item.project_id,
          planId: plan.id,
          title,
          sortOrder: index,
          status: "ready",
        }),
      );
    updateInboxStatus(item.id, "planned");
    return { plan, tasks };
  });
  return tx();
}

export function saveUpload(fileName: string, bytes: Buffer): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const unique = `${Date.now()}-${safe}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, unique), bytes);
  return `/uploads/${unique}`;
}
