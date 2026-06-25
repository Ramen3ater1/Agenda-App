import { describe, it, expect } from "vitest";
import { taskReducer, type DataState } from "@/store/taskReducer";
import type { Task, Folder, Workspace } from "@/types";

function base(): DataState {
  const task: Task = {
    id: "t1", title: "A", description: "", priority: "medium", status: "todo",
    deadline: "2026-06-20", steps: [{ id: "s1", title: "x", done: false }],
    folderId: "f1", workspaceId: "w1", recurrence: "weekly",
  };
  const folder: Folder = { id: "f1", name: "F" };
  const ws: Workspace = { id: "w1", name: "A", taskId: "t1", resources: [], sessions: [] };
  return { tasks: [task], folders: [folder], workspaces: [ws], gcalConnected: false };
}

describe("taskReducer", () => {
  it("ADD_TASK appends", () => {
    const t: Task = { id: "t2", title: "B", description: "", priority: "low", status: "todo", deadline: "2026-06-21", steps: [], recurrence: "none" };
    const s = taskReducer(base(), { type: "ADD_TASK", task: t });
    expect(s.tasks.map(x => x.id)).toEqual(["t1", "t2"]);
  });

  it("UPDATE_TASK merges fields", () => {
    const s = taskReducer(base(), { type: "UPDATE_TASK", id: "t1", updates: { priority: "critical" } });
    expect(s.tasks[0].priority).toBe("critical");
  });

  it("TOGGLE_TASK todo→done checks all steps", () => {
    const s = taskReducer(base(), { type: "TOGGLE_TASK", id: "t1" });
    expect(s.tasks[0].status).toBe("done");
    expect(s.tasks[0].steps.every(st => st.done)).toBe(true);
  });

  it("TOGGLE_TASK done→todo flips back", () => {
    const done = taskReducer(base(), { type: "TOGGLE_TASK", id: "t1" });
    const back = taskReducer(done, { type: "TOGGLE_TASK", id: "t1" });
    expect(back.tasks[0].status).toBe("todo");
  });

  it("RESET_RECURRING advances and resets", () => {
    const s = taskReducer(base(), { type: "RESET_RECURRING", id: "t1" });
    expect(s.tasks[0].status).toBe("todo");
    expect(s.tasks[0].deadline).toBe("2026-06-27");
    expect(s.tasks[0].steps[0].done).toBe(false);
  });

  it("DELETE_TASK removes task and its workspace", () => {
    const s = taskReducer(base(), { type: "DELETE_TASK", id: "t1" });
    expect(s.tasks).toHaveLength(0);
    expect(s.workspaces).toHaveLength(0);
  });

  it("DELETE_FOLDER removes folder and clears folderId", () => {
    const s = taskReducer(base(), { type: "DELETE_FOLDER", id: "f1" });
    expect(s.folders).toHaveLength(0);
    expect(s.tasks[0].folderId).toBeUndefined();
  });

  it("ADD_SESSION appends to workspace", () => {
    const s = taskReducer(base(), { type: "ADD_SESSION", workspaceId: "w1", session: { id: "x", date: "2026-06-15", duration: 10, comment: "c" } });
    expect(s.workspaces[0].sessions).toHaveLength(1);
  });

  it("APPLY_OPTIMIZATION sets arbitrary field", () => {
    const s = taskReducer(base(), { type: "APPLY_OPTIMIZATION", taskId: "t1", field: "status", value: "in-progress" });
    expect(s.tasks[0].status).toBe("in-progress");
  });

  it("SET_GCAL toggles flag", () => {
    const s = taskReducer(base(), { type: "SET_GCAL", connected: true });
    expect(s.gcalConnected).toBe(true);
  });

  it("REPLACE_ALL swaps the whole state", () => {
    const replacement: DataState = {
      tasks: [{ id: "tz", title: "Z", description: "", priority: "low", status: "todo", deadline: "2026-07-01", steps: [], recurrence: "none" }],
      folders: [{ id: "fz", name: "Zed" }],
      workspaces: [],
      gcalConnected: true,
    };
    const s = taskReducer(base(), { type: "REPLACE_ALL", state: replacement });
    expect(s).toEqual(replacement);
  });
});
