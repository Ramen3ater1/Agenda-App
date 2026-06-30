export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in-progress" | "done";
export type SmartList = "all";
export type ResourceType = "link" | "file" | "note";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

// Planner axes — see docs/superpowers/specs/2026-06-28-three-axis-planner-design.md
export type PlannerLevel = "day" | "week" | "month";
export type PlannerView = "checklist" | "calendar" | "timeline";

export interface TaskStep {
  id: string;
  title: string;
  done: boolean;
}

export interface Folder {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  deadline: string;
  steps: TaskStep[];
  folderId?: string;
  workspaceId?: string;
  recurrence: RecurrenceType;
  // Scheduling — optional, backward compatible. When absent, the task is treated
  // as an all-day task on its `deadline` date (see lib/timeWindow.ts).
  startDate?: string;   // "2026-06-28"
  startTime?: string;   // "09:30" (24h); absent = all-day
  durationMin?: number; // estimated minutes; length of calendar/timeline blocks
  location?: string;    // where the task happens; shown on timeline blocks
}

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  value: string;
}

export interface WorkSession {
  id: string;
  date: string;
  duration: number;
  comment: string;
}

export interface Workspace {
  id: string;
  name: string;
  taskId?: string;
  stepId?: string;
  resources: Resource[];
  sessions: WorkSession[];
}

export interface GCalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  context?: string;
  timeline: string;
  status: "pending" | "accepted" | "removed";
  refined?: boolean;
}

export interface OptimizeSuggestion {
  id: string;
  title: string;
  description: string;
  tag: string;
  taskId: string;
  field: string;
  value: unknown;
  status: "pending" | "accepted" | "rejected";
}
