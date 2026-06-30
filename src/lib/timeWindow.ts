import type { Task, PlannerLevel } from "@/types";
import type { TaskSection } from "@/lib/utils";
import { orderTasks } from "@/lib/utils";

// ── Date primitives (all local time, to agree with utils.today/todayISO) ──────

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// Monday-based week start.
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  r.setDate(r.getDate() - dow);
  return r;
}

// ── Time-of-day primitives (minutes from midnight) ───────────────────────────

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function snap(min: number, step = 15): number {
  return Math.round(min / step) * step;
}

// ── Time window for a level + anchor date ────────────────────────────────────

export interface TimeWindow {
  level: PlannerLevel;
  anchor: string; // ISO anchor date the window is built around
  start: Date;    // inclusive local midnight
  end: Date;      // exclusive local midnight
  label: string;
}

export function getWindow(level: PlannerLevel, anchorISO: string): TimeWindow {
  const anchor = parseISO(anchorISO);
  if (level === "day") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return {
      level, anchor: anchorISO, start, end,
      label: start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    };
  }
  if (level === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const last = new Date(end); last.setDate(last.getDate() - 1);
    const sameMonth = start.getMonth() === last.getMonth();
    const startLbl = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLbl = last.toLocaleDateString("en-US", sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
    return { level, anchor: anchorISO, start, end, label: `${startLbl} – ${endLbl}` };
  }
  // month
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  return {
    level, anchor: anchorISO, start, end,
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

// Next/previous window — returns the new anchor ISO.
export function shiftWindow(level: PlannerLevel, anchorISO: string, dir: -1 | 1): string {
  const d = parseISO(anchorISO);
  if (level === "day") d.setDate(d.getDate() + dir);
  else if (level === "week") d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return toISO(d);
}

// Every day (local midnight) covered by the window.
export function daysInWindow(w: TimeWindow): Date[] {
  const days: Date[] = [];
  const cur = new Date(w.start);
  while (cur < w.end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ── Task scheduling accessors (with deadline fallback) ───────────────────────

export function taskStartISO(t: Task): string {
  return t.startDate ?? t.deadline;
}

export function isAllDay(t: Task): boolean {
  return !t.startTime;
}

export function taskStartMinutes(t: Task): number {
  return t.startTime ? timeToMinutes(t.startTime) : 9 * 60; // default 09:00 on a grid
}

export function taskDurationMin(t: Task): number {
  return t.durationMin ?? 60;
}

export function taskEndMinutes(t: Task): number {
  return Math.min(24 * 60, taskStartMinutes(t) + taskDurationMin(t));
}

export function taskInWindow(t: Task, w: TimeWindow): boolean {
  const d = parseISO(taskStartISO(t));
  return d >= w.start && d < w.end;
}

export function tasksInWindow(tasks: Task[], w: TimeWindow): Task[] {
  return tasks.filter(t => taskInWindow(t, w));
}

// ── Checklist grouping per level ─────────────────────────────────────────────

export function bucketByWindow(tasks: Task[], w: TimeWindow): TaskSection[] {
  const inWin = tasksInWindow(tasks, w);

  if (w.level === "day") {
    const morning: Task[] = [], afternoon: Task[] = [], evening: Task[] = [], anytime: Task[] = [];
    for (const t of inWin) {
      if (isAllDay(t)) { anytime.push(t); continue; }
      const m = taskStartMinutes(t);
      if (m < 12 * 60) morning.push(t);
      else if (m < 17 * 60) afternoon.push(t);
      else evening.push(t);
    }
    return [
      { key: "morning", label: "Morning", tasks: orderTasks(morning) },
      { key: "afternoon", label: "Afternoon", tasks: orderTasks(afternoon) },
      { key: "evening", label: "Evening", tasks: orderTasks(evening) },
      { key: "anytime", label: "Anytime", tasks: orderTasks(anytime) },
    ].filter(s => s.tasks.length > 0);
  }

  if (w.level === "week") {
    return daysInWindow(w).map(day => {
      const iso = toISO(day);
      const dayTasks = inWin.filter(t => taskStartISO(t) === iso);
      return {
        key: iso,
        label: day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        tasks: orderTasks(dayTasks),
      };
    }).filter(s => s.tasks.length > 0);
  }

  // month → group by Monday-based week
  const weeks = new Map<string, Task[]>();
  for (const t of inWin) {
    const ws = toISO(startOfWeek(parseISO(taskStartISO(t))));
    (weeks.get(ws) ?? weeks.set(ws, []).get(ws)!).push(t);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ws, items]) => ({
      key: ws,
      label: `Week of ${parseISO(ws).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      tasks: orderTasks(items),
    }));
}
