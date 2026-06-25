import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { migrateLocalToCloud } from "@/lib/db/migrate";
import { supabase } from "@/lib/supabase";
import type { DataState } from "@/store/taskReducer";

const inserted: string[] = [];
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

beforeEach(() => {
  inserted.length = 0;
  (supabase.from as Mock).mockImplementation((t: string) => ({
    insert: (_p: unknown) => { inserted.push(t); return Promise.resolve({ error: null }); },
  }));
});

const local: DataState = {
  folders: [{ id: "f1", name: "F" }],
  tasks: [{ id: "t1", title: "T", description: "", priority: "low", status: "todo", deadline: "", steps: [{ id: "s1", title: "a", done: false }], folderId: "f1", recurrence: "none" }],
  workspaces: [{ id: "w1", name: "W", taskId: "t1", resources: [{ id: "r1", type: "link", title: "x", value: "y" }], sessions: [{ id: "se1", date: "d", duration: 1, comment: "c" }] }],
  gcalConnected: false,
};

describe("migrateLocalToCloud", () => {
  it("writes tables in FK-safe order", async () => {
    await migrateLocalToCloud(local);
    expect(inserted.indexOf("folders")).toBeLessThan(inserted.indexOf("tasks"));
    expect(inserted.indexOf("tasks")).toBeLessThan(inserted.indexOf("task_steps"));
    expect(inserted.indexOf("task_steps")).toBeLessThan(inserted.indexOf("workspaces"));
    expect(inserted.indexOf("workspaces")).toBeLessThan(inserted.indexOf("resources"));
    expect(inserted.indexOf("workspaces")).toBeLessThan(inserted.indexOf("work_sessions"));
  });
  it("skips empty collections", async () => {
    await migrateLocalToCloud({ tasks: [], folders: [], workspaces: [], gcalConnected: false });
    expect(inserted.length).toBe(0);
  });
});
