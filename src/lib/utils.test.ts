import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uid, todayISO, formatDate, formatDuration, daysLeft,
  daysInMonth, firstDayOfMonth, advanceDeadline,
} from "@/lib/utils";

describe("uid", () => {
  it("returns a non-empty string and is reasonably unique", () => {
    const a = uid();
    const b = uid();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("formatDuration", () => {
  it("formats seconds as HH:MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(8100)).toBe("02:15:00");
    expect(formatDuration(59)).toBe("00:00:59");
  });
});

describe("formatDate", () => {
  it("short mode → 'Jun 20'", () => {
    expect(formatDate("2026-06-20", "short")).toBe("Jun 20");
  });
  it("session mode → includes weekday", () => {
    expect(formatDate("2026-06-20", "session")).toBe("Sat, Jun 20");
  });
});

describe("advanceDeadline", () => {
  it("daily adds one day", () => {
    expect(advanceDeadline("2026-06-20", "daily")).toBe("2026-06-21");
  });
  it("weekly adds seven days", () => {
    expect(advanceDeadline("2026-06-20", "weekly")).toBe("2026-06-27");
  });
  it("monthly adds one month", () => {
    expect(advanceDeadline("2026-06-20", "monthly")).toBe("2026-07-20");
  });
  it("none returns same date", () => {
    expect(advanceDeadline("2026-06-20", "none")).toBe("2026-06-20");
  });
});

describe("calendar math", () => {
  it("daysInMonth June 2026 = 30", () => {
    expect(daysInMonth(2026, 5)).toBe(30);
  });
  it("firstDayOfMonth June 2026 = Monday(1)", () => {
    expect(firstDayOfMonth(2026, 5)).toBe(1);
  });
});

describe("daysLeft (uses real today)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("future deadline is positive", () => {
    expect(daysLeft("2026-06-20")).toBe(5);
  });
  it("today is 0", () => {
    expect(daysLeft("2026-06-15")).toBe(0);
  });
  it("past deadline is negative", () => {
    expect(daysLeft("2026-06-10")).toBe(-5);
  });
});
import {
  completeRecurringTask, createWorkSession, sortTasks,
  isTodayTask, selectListTasks, generateOptimizations,
} from "@/lib/utils";
import type { Task } from "@/types";

function mkTask(over: Partial<Task> = {}): Task {
  return {
    id: over.id ?? uid(),
    title: over.title ?? "T",
    description: "",
    priority: over.priority ?? "medium",
    status: over.status ?? "todo",
    deadline: over.deadline ?? "2026-06-20",
    steps: over.steps ?? [],
    folderId: over.folderId,
    workspaceId: over.workspaceId,
    recurrence: over.recurrence ?? "none",
  };
}

describe("completeRecurringTask", () => {
  it("advances deadline, resets to todo, unchecks steps", () => {
    const t = mkTask({
      status: "done", recurrence: "weekly", deadline: "2026-06-20",
      steps: [{ id: "s1", title: "a", done: true }],
    });
    const next = completeRecurringTask(t);
    expect(next.status).toBe("todo");
    expect(next.deadline).toBe("2026-06-27");
    expect(next.steps[0].done).toBe(false);
  });
});

describe("createWorkSession", () => {
  it("builds a session with given fields and a string id", () => {
    const s = createWorkSession("2026-06-15", 120, "note");
    expect(s.date).toBe("2026-06-15");
    expect(s.duration).toBe(120);
    expect(s.comment).toBe("note");
    expect(typeof s.id).toBe("string");
  });
});

describe("sortTasks", () => {
  it("done last, then by priority, then by deadline", () => {
    const done = mkTask({ id: "d", status: "done", priority: "critical" });
    const low = mkTask({ id: "low", priority: "low", deadline: "2026-06-10" });
    const crit = mkTask({ id: "crit", priority: "critical", deadline: "2026-06-30" });
    const out = sortTasks([done, low, crit]).map(t => t.id);
    expect(out).toEqual(["crit", "low", "d"]);
  });
});

describe("isTodayTask (fake time 2026-06-15)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-15T12:00:00")); });
  afterEach(() => vi.useRealTimers());
  it("in-progress is today", () => {
    expect(isTodayTask(mkTask({ status: "in-progress", deadline: "2026-12-01" }))).toBe(true);
  });
  it("due tomorrow is today", () => {
    expect(isTodayTask(mkTask({ deadline: "2026-06-16" }))).toBe(true);
  });
  it("far future todo is not today", () => {
    expect(isTodayTask(mkTask({ deadline: "2026-12-01" }))).toBe(false);
  });
  it("done is never today", () => {
    expect(isTodayTask(mkTask({ status: "done", deadline: "2026-06-15" }))).toBe(false);
  });
});

describe("selectListTasks", () => {
  it("'all' returns sorted everything", () => {
    const a = mkTask({ id: "a", priority: "low" });
    const b = mkTask({ id: "b", priority: "critical" });
    expect(selectListTasks([a, b], "all").map(t => t.id)).toEqual(["b", "a"]);
  });
  it("folder key filters by folderId", () => {
    const a = mkTask({ id: "a", folderId: "f1" });
    const b = mkTask({ id: "b", folderId: "f2" });
    expect(selectListTasks([a, b], "f1").map(t => t.id)).toEqual(["a"]);
  });
  it("'calendar' returns empty", () => {
    expect(selectListTasks([mkTask()], "calendar")).toEqual([]);
  });
});

describe("generateOptimizations (fake time 2026-06-15)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-15T12:00:00")); });
  afterEach(() => vi.useRealTimers());
  it("flags an imminent non-critical todo and caps at 5", () => {
    const tasks = [mkTask({ status: "todo", priority: "high", deadline: "2026-06-17" })];
    const out = generateOptimizations(tasks);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out[0].taskId).toBe(tasks[0].id);
  });
});
