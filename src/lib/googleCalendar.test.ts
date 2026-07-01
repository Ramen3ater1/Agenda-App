import { describe, it, expect } from "vitest";
import { __test } from "./googleCalendar";
import type { Task } from "@/types";

const { mapEvent, eventBody, to12h } = __test;

function mkTask(over: Partial<Task>): Task {
  return {
    id: "t", title: "Write report", description: "", priority: "medium",
    status: "todo", deadline: "2026-06-30", steps: [], recurrence: "none", ...over,
  };
}

describe("to12h", () => {
  it("formats 24h to 12h with am/pm", () => {
    expect(to12h("09:00")).toBe("9:00 AM");
    expect(to12h("13:30")).toBe("1:30 PM");
    expect(to12h("00:00")).toBe("12:00 AM");
    expect(to12h("12:00")).toBe("12:00 PM");
  });
});

describe("mapEvent", () => {
  it("maps an all-day event", () => {
    const g = mapEvent({ id: "e1", summary: "Holiday", start: { date: "2026-06-30" } });
    expect(g).toEqual({ id: "e1", title: "Holiday", date: "2026-06-30", time: "All day", allDay: true, location: undefined });
  });

  it("maps a timed event with duration (local-time consistent)", () => {
    const s = new Date(2026, 5, 30, 9, 0);
    const e = new Date(s.getTime() + 90 * 60000);
    const g = mapEvent({ id: "e2", summary: "Standup", location: "Zoom", start: { dateTime: s.toISOString() }, end: { dateTime: e.toISOString() } });
    expect(g?.date).toBe("2026-06-30");
    expect(g?.startTime).toBe("09:00");
    expect(g?.durationMin).toBe(90);
    expect(g?.location).toBe("Zoom");
  });

  it("falls back to (no title) and returns null without a start", () => {
    expect(mapEvent({ id: "e3", start: { date: "2026-06-30" } })?.title).toBe("(no title)");
    expect(mapEvent({ id: "e4" })).toBeNull();
  });
});

describe("eventBody", () => {
  it("builds an all-day body with exclusive end date", () => {
    const body = eventBody(mkTask({ startDate: "2026-06-30", startTime: undefined }));
    expect(body.start).toEqual({ date: "2026-06-30" });
    expect(body.end).toEqual({ date: "2026-07-01" });
    expect(body.summary).toBe("Write report");
  });

  it("builds a timed body whose duration matches durationMin", () => {
    const body = eventBody(mkTask({ startDate: "2026-06-30", startTime: "09:00", durationMin: 120, location: "Library" }));
    const start = new Date((body.start as { dateTime: string }).dateTime).getTime();
    const end = new Date((body.end as { dateTime: string }).dateTime).getTime();
    expect((end - start) / 60000).toBe(120);
    expect(body.location).toBe("Library");
  });
});
