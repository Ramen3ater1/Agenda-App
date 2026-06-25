import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { fetchAllData, upsertTask, deleteTask, upsertFolder, deleteFolder, upsertWorkspace, syncAction } from "@/lib/db/sync";
import { supabase } from "@/lib/supabase";
import type { DataState } from "@/store/taskReducer";

// chainable mock: from(table) returns an object whose methods record calls and resolve.
const calls: { table: string; op: string; payload?: unknown; eqCol?: string; eqVal?: unknown }[] = [];

function makeChain(table: string) {
  const chain: Record<string, unknown> = {};
  const rec = (op: string, payload?: unknown, eqCol?: string, eqVal?: unknown) =>
    calls.push({ table, op, payload, eqCol, eqVal });
  chain.upsert = (p: unknown) => { rec("upsert", p); return Promise.resolve({ error: null }); };
  chain.insert = (p: unknown) => { rec("insert", p); return Promise.resolve({ error: null }); };
  chain.delete = () => ({ eq: (c: string, v: unknown) => { rec("delete", undefined, c, v); return Promise.resolve({ error: null }); } });
  chain.select = () => Promise.resolve({ data: [], error: null });
  return chain;
}

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

beforeEach(() => {
  calls.length = 0;
  (supabase.from as Mock).mockClear();
  (supabase.from as Mock).mockImplementation((t: string) => makeChain(t));
});

const sampleTask = { id: "t1", title: "T", description: "", priority: "medium" as const, status: "todo" as const, deadline: "", steps: [{ id: "s1", title: "a", done: false }], recurrence: "none" as const };

describe("entity writes", () => {
  it("upsertTask upserts the task row then replaces its steps", async () => {
    await upsertTask(sampleTask, 0);
    expect(calls.find(c => c.table === "tasks" && c.op === "upsert")).toBeTruthy();
    expect(calls.find(c => c.table === "task_steps" && c.op === "delete" && c.eqCol === "task_id" && c.eqVal === "t1")).toBeTruthy();
    expect(calls.find(c => c.table === "task_steps" && c.op === "insert")).toBeTruthy();
  });
  it("upsertTask with no steps does not insert steps", async () => {
    await upsertTask({ ...sampleTask, steps: [] }, 0);
    expect(calls.find(c => c.table === "task_steps" && c.op === "insert")).toBeFalsy();
  });
  it("deleteTask deletes workspace (if any) then the task", async () => {
    await deleteTask("t1", "w1");
    expect(calls.find(c => c.table === "workspaces" && c.op === "delete" && c.eqVal === "w1")).toBeTruthy();
    expect(calls.find(c => c.table === "tasks" && c.op === "delete" && c.eqVal === "t1")).toBeTruthy();
  });
  it("upsertFolder / deleteFolder hit folders", async () => {
    await upsertFolder({ id: "f1", name: "F" });
    await deleteFolder("f1");
    expect(calls.find(c => c.table === "folders" && c.op === "upsert")).toBeTruthy();
    expect(calls.find(c => c.table === "folders" && c.op === "delete" && c.eqVal === "f1")).toBeTruthy();
  });
  it("upsertWorkspace upserts workspace, replaces resources, upserts sessions", async () => {
    await upsertWorkspace({ id: "w1", name: "W", taskId: "t1", resources: [{ id: "r1", type: "link", title: "x", value: "y" }], sessions: [{ id: "se1", date: "d", duration: 1, comment: "c" }] });
    expect(calls.find(c => c.table === "workspaces" && c.op === "upsert")).toBeTruthy();
    expect(calls.find(c => c.table === "resources" && c.op === "delete" && c.eqVal === "w1")).toBeTruthy();
    expect(calls.find(c => c.table === "resources" && c.op === "insert")).toBeTruthy();
    expect(calls.find(c => c.table === "work_sessions" && c.op === "upsert")).toBeTruthy();
  });
});

describe("fetchAllData", () => {
  it("queries all six tables and returns a DataState", async () => {
    const s = await fetchAllData();
    expect((supabase.from as Mock).mock.calls.map(c => c[0]).sort()).toEqual(
      ["folders", "resources", "task_steps", "tasks", "work_sessions", "workspaces"],
    );
    expect(s).toEqual({ tasks: [], folders: [], workspaces: [], gcalConnected: false });
  });
});

describe("syncAction", () => {
  const empty: DataState = { tasks: [], folders: [], workspaces: [], gcalConnected: false };
  it("ADD_TASK → upsertTask on the new task", async () => {
    const next: DataState = { ...empty, tasks: [sampleTask] };
    await syncAction({ type: "ADD_TASK", task: sampleTask }, empty, next);
    expect(calls.find(c => c.table === "tasks" && c.op === "upsert")).toBeTruthy();
  });
  it("DELETE_TASK → deleteTask with the previous task's workspaceId", async () => {
    const prev: DataState = { ...empty, tasks: [{ ...sampleTask, workspaceId: "w9" }] };
    await syncAction({ type: "DELETE_TASK", id: "t1" }, prev, empty);
    expect(calls.find(c => c.table === "workspaces" && c.op === "delete" && c.eqVal === "w9")).toBeTruthy();
    expect(calls.find(c => c.table === "tasks" && c.op === "delete" && c.eqVal === "t1")).toBeTruthy();
  });
  it("SET_GCAL → no DB calls", async () => {
    await syncAction({ type: "SET_GCAL", connected: true }, empty, empty);
    expect(calls.length).toBe(0);
  });
});
