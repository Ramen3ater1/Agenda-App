export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in-progress" | "done";
export type SmartList = "today" | "all" | "calendar";
export type ResourceType = "link" | "file" | "note";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

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
