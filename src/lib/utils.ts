import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RecurrenceType, Task, WorkSession, OptimizeSuggestion, Priority } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type DateFormat = "short" | "session";
export function formatDate(iso: string, fmt: DateFormat = "short"): string {
  const d = new Date(iso + "T00:00:00");
  if (fmt === "session") {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysLeft(deadline: string): number {
  return Math.ceil((new Date(deadline + "T00:00:00").getTime() - today().getTime()) / 86400000);
}

export function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

export function firstDayOfMonth(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}

export function advanceDeadline(deadline: string, recurrence: RecurrenceType): string {
  const d = new Date(deadline + "T00:00:00");
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function completeRecurringTask(task: Task): Task {
  return {
    ...task,
    status: "todo",
    deadline: advanceDeadline(task.deadline, task.recurrence),
    steps: task.steps.map(s => ({ ...s, done: false })),
  };
}

export function createWorkSession(date: string, duration: number, comment: string): WorkSession {
  return { id: uid(), date, duration, comment };
}

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortTasks(arr: Task[]): Task[] {
  return [...arr].sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return a.deadline.localeCompare(b.deadline);
  });
}

export function isTodayTask(t: Task): boolean {
  // Today = due exactly today, OR in-progress (pinned regardless of due date).
  return t.status !== "done" && (daysLeft(t.deadline) === 0 || t.status === "in-progress");
}

// Preserve manual (array) order — active tasks first, completed ones sink to the bottom.
// This replaces the old priority auto-sort so drag-to-reorder has an effect.
export function orderTasks(arr: Task[]): Task[] {
  return [...arr.filter(t => t.status !== "done"), ...arr.filter(t => t.status === "done")];
}

export function selectListTasks(tasks: Task[], listKey: string): Task[] {
  const filtered =
    listKey === "today" ? tasks.filter(isTodayTask)
    : listKey === "all" ? tasks
    : listKey === "calendar" ? []
    : tasks.filter(t => t.folderId === listKey);
  return orderTasks(filtered);
}

export interface TaskSection {
  key: string;
  label: string;
  tasks: Task[];
}

// Human-readable due label. Special-cases Yesterday / Today / Tomorrow; everything
// else keeps the original "Due Jun 25 · 2d left / overdue" style.
export function dueLabel(deadline: string): string {
  const dl = daysLeft(deadline);
  if (dl === -1) return "Yesterday";
  if (dl === 0) return "Today";
  if (dl === 1) return "Tomorrow";
  const base = `Due ${formatDate(deadline, "short")}`;
  if (dl >= 2 && dl <= 3) return `${base} · ${dl}d left`;
  if (dl < -1) return `${base} · overdue`;
  return base;
}

// Partition the "All" list into ordered, non-overlapping buckets.
// In-progress / due-today tasks are pinned to Today; everything else goes by deadline.
// Week boundaries are Monday–Sunday.
export function bucketAllTasks(tasks: Task[]): TaskSection[] {
  const overdue: Task[] = [], todayB: Task[] = [], tomorrow: Task[] = [];
  const thisWeek: Task[] = [], nextWeek: Task[] = [], later: Task[] = [];

  const t0 = today();
  const dow = t0.getDay();                 // 0 = Sun … 6 = Sat
  const daysToSunday = (7 - dow) % 7;       // Mon–Sun week: 0 if today is Sunday
  const endThisWeek = t0.getTime() + daysToSunday * 86400000;
  const endNextWeek = endThisWeek + 7 * 86400000;

  for (const task of tasks) {
    if (isTodayTask(task)) { todayB.push(task); continue; }
    const dl = daysLeft(task.deadline);
    const dTime = new Date(task.deadline + "T00:00:00").getTime();
    if (dl < 0) overdue.push(task);
    else if (dl === 0) todayB.push(task);          // done-today tasks (isTodayTask excludes done)
    else if (dl === 1) tomorrow.push(task);
    else if (dTime <= endThisWeek) thisWeek.push(task);
    else if (dTime <= endNextWeek) nextWeek.push(task);
    else later.push(task);
  }

  return [
    { key: "overdue",   label: "Overdue",   tasks: orderTasks(overdue) },
    { key: "today",     label: "Today",     tasks: orderTasks(todayB) },
    { key: "tomorrow",  label: "Tomorrow",  tasks: orderTasks(tomorrow) },
    { key: "this-week", label: "This Week", tasks: orderTasks(thisWeek) },
    { key: "next-week", label: "Next Week", tasks: orderTasks(nextWeek) },
    { key: "later",     label: "Later",     tasks: orderTasks(later) },
  ].filter(s => s.tasks.length > 0);
}

export function generateOptimizations(tasks: Task[]): OptimizeSuggestion[] {
  const suggestions: OptimizeSuggestion[] = [];
  tasks.forEach(t => {
    const dl = daysLeft(t.deadline);
    if (t.status === "todo" && dl <= 7 && dl >= 0 && t.priority !== "critical") {
      suggestions.push({
        id: uid(), tag: "Priority", taskId: t.id, field: "priority", value: "critical",
        title: `Upgrade "${t.title}" to Critical`,
        description: `Due in ${dl} day${dl === 1 ? "" : "s"} with no progress. Marking critical surfaces it at the top of your list.`,
        status: "pending",
      });
    }
    if (t.status === "todo" && dl <= 5 && dl >= 0) {
      suggestions.push({
        id: uid(), tag: "Status", taskId: t.id, field: "status", value: "in-progress",
        title: `Start "${t.title}" now`,
        description: `Due in ${dl} day${dl === 1 ? "" : "s"} and still marked To Do. Set it to In Progress to keep it visible.`,
        status: "pending",
      });
    }
    if (t.priority !== "critical" && t.status === "in-progress" && dl <= 3 && dl >= 0) {
      suggestions.push({
        id: uid(), tag: "Priority", taskId: t.id, field: "priority", value: "critical",
        title: `Prioritize "${t.title}"`,
        description: `In progress and due in ${dl} day${dl === 1 ? "" : "s"}. Bump it to Critical so it leads your list.`,
        status: "pending",
      });
    }
  });
  return suggestions.slice(0, 5);
}
