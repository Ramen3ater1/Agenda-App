import { supabase } from "@/lib/supabase";
import type { Task, Folder, Workspace } from "@/types";
import type { DataState, DataAction } from "@/store/taskReducer";
import {
  assembleDataState, taskToRow, stepToRow, folderToRow,
  workspaceToRow, resourceToRow, sessionToRow,
  type FolderRow, type TaskRow, type TaskStepRow, type WorkspaceRow, type ResourceRow, type WorkSessionRow,
} from "@/lib/db/mappers";

export async function fetchAllData(): Promise<DataState> {
  const [folders, tasks, taskSteps, workspaces, resources, workSessions] = await Promise.all([
    supabase.from("folders").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("task_steps").select("*"),
    supabase.from("workspaces").select("*"),
    supabase.from("resources").select("*"),
    supabase.from("work_sessions").select("*"),
  ]);
  return assembleDataState({
    folders: (folders.data ?? []) as FolderRow[],
    tasks: (tasks.data ?? []) as TaskRow[],
    taskSteps: (taskSteps.data ?? []) as TaskStepRow[],
    workspaces: (workspaces.data ?? []) as WorkspaceRow[],
    resources: (resources.data ?? []) as ResourceRow[],
    workSessions: (workSessions.data ?? []) as WorkSessionRow[],
  });
}

export async function upsertTask(task: Task, position: number): Promise<void> {
  await supabase.from("tasks").upsert(taskToRow(task, position));
  await supabase.from("task_steps").delete().eq("task_id", task.id);
  if (task.steps.length) {
    await supabase.from("task_steps").insert(task.steps.map((s, i) => stepToRow(s, task.id, i)));
  }
}

export async function deleteTask(taskId: string, workspaceId?: string): Promise<void> {
  if (workspaceId) await supabase.from("workspaces").delete().eq("id", workspaceId);
  await supabase.from("tasks").delete().eq("id", taskId);
}

export async function upsertFolder(folder: Folder): Promise<void> {
  await supabase.from("folders").upsert(folderToRow(folder));
}

export async function deleteFolder(folderId: string): Promise<void> {
  await supabase.from("folders").delete().eq("id", folderId);
}

export async function upsertWorkspace(ws: Workspace): Promise<void> {
  await supabase.from("workspaces").upsert(workspaceToRow(ws));
  await supabase.from("resources").delete().eq("workspace_id", ws.id);
  if (ws.resources.length) {
    await supabase.from("resources").insert(ws.resources.map(r => resourceToRow(r, ws.id)));
  }
  if (ws.sessions.length) {
    await supabase.from("work_sessions").upsert(ws.sessions.map(s => sessionToRow(s, ws.id)));
  }
}

export async function syncAction(action: DataAction, prev: DataState, next: DataState): Promise<void> {
  switch (action.type) {
    case "ADD_TASK":
    case "UPDATE_TASK":
    case "TOGGLE_TASK":
    case "RESET_RECURRING":
    case "APPLY_OPTIMIZATION": {
      const id = action.type === "ADD_TASK" ? action.task.id
        : action.type === "APPLY_OPTIMIZATION" ? action.taskId
        : action.id;
      const idx = next.tasks.findIndex(t => t.id === id);
      if (idx >= 0) await upsertTask(next.tasks[idx], idx);
      return;
    }
    case "SET_TASK_ORDER": {
      await Promise.all(action.ids.map(id => {
        const idx = next.tasks.findIndex(t => t.id === id);
        return idx >= 0 ? upsertTask(next.tasks[idx], idx) : Promise.resolve();
      }));
      return;
    }
    case "DELETE_TASK": {
      const task = prev.tasks.find(t => t.id === action.id);
      await deleteTask(action.id, task?.workspaceId);
      return;
    }
    case "ADD_FOLDER":
      await upsertFolder(action.folder);
      return;
    case "RENAME_FOLDER": {
      const f = next.folders.find(x => x.id === action.id);
      if (f) await upsertFolder(f);
      return;
    }
    case "DELETE_FOLDER":
      await deleteFolder(action.id);
      return;
    case "ENSURE_WORKSPACE":
    case "UPDATE_WORKSPACE":
    case "ADD_SESSION": {
      const id = action.type === "ENSURE_WORKSPACE" ? action.workspace.id
        : action.type === "ADD_SESSION" ? action.workspaceId
        : action.id;
      const ws = next.workspaces.find(w => w.id === id);
      if (ws) await upsertWorkspace(ws);
      return;
    }
    case "SET_GCAL":
    case "REPLACE_ALL":
    default:
      return;
  }
}
