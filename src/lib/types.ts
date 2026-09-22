export type InboxType = "todo" | "review";
export type InboxStatus = "new" | "planned" | "dismissed";
export type PlanStatus = "draft" | "active" | "done";
export type TaskStatus = "ready" | "doing" | "done" | "blocked";
export type WorkPlatform = "cursor" | "claude";

export type Project = {
  id: string;
  name: string;
  is_active: number;
};

export type InboxItem = {
  id: string;
  project_id: string;
  type: InboxType;
  title: string;
  notes: string | null;
  page_url: string | null;
  screenshot_url: string | null;
  status: InboxStatus;
  created_at: string;
};

export type Plan = {
  id: string;
  project_id: string;
  title: string;
  summary: string | null;
  source_inbox_item_id: string | null;
  status: PlanStatus;
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  plan_id: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  work_platform: WorkPlatform | null;
  sort_order: number;
  created_at: string;
};

export type ManagerLink = {
  id: string;
  project_id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
};

export type TaskCounts = {
  ready: number;
  doing: number;
  done: number;
  blocked: number;
};
