import type { Task, Folder, Workspace, WorkSession } from "@/types";
import { completeRecurringTask } from "@/lib/utils";
import { loadState, type PersistedState } from "@/lib/storage";
import { INIT_TASKS, INIT_FOLDERS, INIT_WORKSPACES } from "@/constants";

export interface DataState {
  tasks: Task[];
  folders: Folder[];
  workspaces: Workspace[];
  gcalConnected: boolean;
}

export type DataAction =
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; id: string; updates: Partial<Task> }
  | { type: "TOGGLE_TASK"; id: string }
  | { type: "RESET_RECURRING"; id: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "ADD_FOLDER"; folder: Folder }
  | { type: "RENAME_FOLDER"; id: string; name: string }
  | { type: "DELETE_FOLDER"; id: string }
  | { type: "ENSURE_WORKSPACE"; taskId: string; workspace: Workspace }
  | { type: "UPDATE_WORKSPACE"; id: string; updates: Partial<Workspace> }
  | { type: "ADD_SESSION"; workspaceId: string; session: WorkSession }
  | { type: "APPLY_OPTIMIZATION"; taskId: string; field: string; value: unknown }
  | { type: "SET_GCAL"; connected: boolean };

export function taskReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.task] };

    case "UPDATE_TASK":
      return { ...state, tasks: state.tasks.map(t => t.id === action.id ? { ...t, ...action.updates } : t) };

    case "TOGGLE_TASK": {
      const task = state.tasks.find(t => t.id === action.id);
      if (!task) return state;
      if (task.status === "done") {
        return { ...state, tasks: state.tasks.map(t => t.id === action.id ? { ...t, status: "todo" } : t) };
      }
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.id ? { ...t, status: "done", steps: t.steps.map(s => ({ ...s, done: true })) } : t),
      };
    }

    case "RESET_RECURRING":
      return { ...state, tasks: state.tasks.map(t => t.id === action.id ? completeRecurringTask(t) : t) };

    case "DELETE_TASK": {
      const task = state.tasks.find(t => t.id === action.id);
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.id),
        workspaces: task?.workspaceId ? state.workspaces.filter(w => w.id !== task.workspaceId) : state.workspaces,
      };
    }

    case "ADD_FOLDER":
      return { ...state, folders: [...state.folders, action.folder] };

    case "RENAME_FOLDER":
      return { ...state, folders: state.folders.map(f => f.id === action.id ? { ...f, name: action.name } : f) };

    case "DELETE_FOLDER":
      return {
        ...state,
        folders: state.folders.filter(f => f.id !== action.id),
        tasks: state.tasks.map(t => t.folderId === action.id ? { ...t, folderId: undefined } : t),
      };

    case "ENSURE_WORKSPACE":
      return {
        ...state,
        workspaces: [...state.workspaces, action.workspace],
        tasks: state.tasks.map(t => t.id === action.taskId ? { ...t, workspaceId: action.workspace.id } : t),
      };

    case "UPDATE_WORKSPACE":
      return { ...state, workspaces: state.workspaces.map(w => w.id === action.id ? { ...w, ...action.updates } : w) };

    case "ADD_SESSION":
      return {
        ...state,
        workspaces: state.workspaces.map(w => w.id === action.workspaceId ? { ...w, sessions: [...w.sessions, action.session] } : w),
      };

    case "APPLY_OPTIMIZATION":
      return { ...state, tasks: state.tasks.map(t => t.id === action.taskId ? { ...t, [action.field]: action.value } : t) };

    case "SET_GCAL":
      return { ...state, gcalConnected: action.connected };

    default:
      return state;
  }
}

export function initDataState(): DataState {
  const persisted: PersistedState | null = loadState();
  if (persisted) return persisted;
  return { tasks: INIT_TASKS, folders: INIT_FOLDERS, workspaces: INIT_WORKSPACES, gcalConnected: false };
}
