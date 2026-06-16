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
