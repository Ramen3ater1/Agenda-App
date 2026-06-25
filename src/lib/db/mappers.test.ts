import { describe, it, expect } from "vitest";
import {
  assembleDataState, taskToRow, stepToRow, folderToRow,
  workspaceToRow, resourceToRow, sessionToRow, type RawRows,
} from "@/lib/db/mappers";

const raw: RawRows = {
  folders: [{ id: "f1", name: "Work" }],
  tasks: [
    { id: "t2", title: "Second", description: "", priority: "low", status: "todo", deadline: "", folder_id: null, recurrence: "none", position: 1, updated_at: "2026-06-24T00:00:00Z" },
    { id: "t1", title: "First", description: "d", priority: "high", status: "todo", deadline: "2026-07-01", folder_id: "f1", recurrence: "daily", position: 0, updated_at: "2026-06-24T00:00:00Z" },
  ],
  taskSteps: [
    { id: "s2", task_id: "t1", title: "b", done: true, position: 1 },
    { id: "s1", task_id: "t1", title: "a", done: false, position: 0 },
  ],
  workspaces: [{ id: "w1", name: "WS", task_id: "t1", step_id: null }],
  resources: [{ id: "r1", workspace_id: "w1", type: "link", title: "L", value: "u" }],
  workSessions: [{ id: "se1", workspace_id: "w1", date: "2026-06-20", duration: 60, comment: "c" }],
};

describe("assembleDataState", () => {
  it("orders tasks by position and nests steps in order", () => {
    const s = assembleDataState(raw);
    expect(s.tasks.map(t => t.id)).toEqual(["t1", "t2"]);
    expect(s.tasks[0].steps.map(st => st.id)).toEqual(["s1", "s2"]);
    expect(s.tasks[0].folderId).toBe("f1");
    expect(s.tasks[1].folderId).toBeUndefined();
  });
  it("reverse-links workspaceId onto its task", () => {
    const s = assembleDataState(raw);
    expect(s.tasks.find(t => t.id === "t1")!.workspaceId).toBe("w1");
  });
  it("nests resources and sessions into the workspace", () => {
    const s = assembleDataState(raw);
    const w = s.workspaces[0];
    expect(w.taskId).toBe("t1");
    expect(w.resources.map(r => r.id)).toEqual(["r1"]);
    expect(w.sessions.map(x => x.id)).toEqual(["se1"]);
  });
});

describe("domain → row", () => {
  it("taskToRow flattens folderId→folder_id and carries position", () => {
    const row = taskToRow(
      { id: "t1", title: "T", description: "", priority: "medium", status: "todo", deadline: "", steps: [], recurrence: "none" },
      3,
    );
    expect(row).toMatchObject({ id: "t1", folder_id: null, position: 3, priority: "medium" });
    expect(typeof row.updated_at).toBe("string");
  });
  it("stepToRow / resourceToRow / sessionToRow attach parent id and position", () => {
    expect(stepToRow({ id: "s1", title: "a", done: false }, "t1", 2)).toEqual({ id: "s1", task_id: "t1", title: "a", done: false, position: 2 });
    expect(resourceToRow({ id: "r1", type: "note", title: "n", value: "v" }, "w1")).toEqual({ id: "r1", workspace_id: "w1", type: "note", title: "n", value: "v" });
    expect(sessionToRow({ id: "se1", date: "d", duration: 5, comment: "c" }, "w1")).toEqual({ id: "se1", workspace_id: "w1", date: "d", duration: 5, comment: "c" });
  });
  it("folderToRow / workspaceToRow map ids", () => {
    expect(folderToRow({ id: "f1", name: "F" })).toEqual({ id: "f1", name: "F" });
    expect(workspaceToRow({ id: "w1", name: "W", taskId: "t1", resources: [], sessions: [] })).toEqual({ id: "w1", name: "W", task_id: "t1", step_id: null });
  });
});
