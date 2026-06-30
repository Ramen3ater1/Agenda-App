import { describe, it, expect } from "vitest";
import {
  getWindow, shiftWindow, daysInWindow, taskStartISO, taskInWindow,
  bucketByWindow, minutesToTime, timeToMinutes, snap, startOfWeek, parseISO, toISO,
} from "./timeWindow";
import type { Task } from "@/types";

function mkTask(over: Partial<Task>): Task {
  return {
    id: over.id ?? "x", title: "t", description: "", priority: "medium",
    status: "todo", deadline: "2026-06-28", steps: [], recurrence: "none", ...over,
  };
}

describe("getWindow", () => {
  it("day window is a single day", () => {
    const w = getWindow("day", "2026-06-28");
    expect(toISO(w.start)).toBe("2026-06-28");
    expect(toISO(w.end)).toBe("2026-06-29");
  });

  it("week window is Monday→next Monday", () => {
    const w = getWindow("week", "2026-06-28"); // Sunday
    expect(toISO(w.start)).toBe("2026-06-22"); // Monday
    expect(toISO(w.end)).toBe("2026-06-29");
    expect(daysInWindow(w)).toHaveLength(7);
  });

  it("month window spans the whole month", () => {
    const w = getWindow("month", "2026-06-15");
    expect(toISO(w.start)).toBe("2026-06-01");
    expect(toISO(w.end)).toBe("2026-07-01");
  });
});

describe("shiftWindow", () => {
  it("crosses month boundary by day", () => {
    expect(shiftWindow("day", "2026-06-30", 1)).toBe("2026-07-01");
  });
  it("crosses year boundary by month", () => {
    expect(shiftWindow("month", "2026-12-10", 1)).toBe("2027-01-10");
  });
  it("moves a full week", () => {
    expect(shiftWindow("week", "2026-06-28", -1)).toBe("2026-06-21");
  });
});

describe("scheduling fallback", () => {
  it("uses startDate when present, else deadline", () => {
    expect(taskStartISO(mkTask({ startDate: "2026-06-10", deadline: "2026-06-28" }))).toBe("2026-06-10");
    expect(taskStartISO(mkTask({ deadline: "2026-06-28" }))).toBe("2026-06-28");
  });
  it("a deadline-only task lands in the window of its deadline", () => {
    const w = getWindow("week", "2026-06-28");
    expect(taskInWindow(mkTask({ deadline: "2026-06-24" }), w)).toBe(true);
    expect(taskInWindow(mkTask({ deadline: "2026-07-05" }), w)).toBe(false);
  });
});

describe("bucketByWindow", () => {
  it("day level groups by time of day", () => {
    const tasks = [
      mkTask({ id: "a", startDate: "2026-06-28", startTime: "08:00" }),
      mkTask({ id: "b", startDate: "2026-06-28", startTime: "15:00" }),
      mkTask({ id: "c", startDate: "2026-06-28" }), // all-day
    ];
    const sections = bucketByWindow(tasks, getWindow("day", "2026-06-28"));
    expect(sections.map(s => s.key)).toEqual(["morning", "afternoon", "anytime"]);
  });

  it("week level groups by day, only non-empty", () => {
    const tasks = [
      mkTask({ id: "a", startDate: "2026-06-22" }),
      mkTask({ id: "b", startDate: "2026-06-22" }),
      mkTask({ id: "c", startDate: "2026-06-25" }),
    ];
    const sections = bucketByWindow(tasks, getWindow("week", "2026-06-28"));
    expect(sections).toHaveLength(2);
    expect(sections[0].tasks).toHaveLength(2);
  });
});

describe("time helpers", () => {
  it("round-trips minutes/time", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
  });
  it("clamps and snaps", () => {
    expect(minutesToTime(-10)).toBe("00:00");
    expect(snap(67, 15)).toBe(60);
    expect(snap(68, 15)).toBe(75);
  });
  it("startOfWeek is Monday", () => {
    expect(toISO(startOfWeek(parseISO("2026-06-28")))).toBe("2026-06-22");
  });
});
