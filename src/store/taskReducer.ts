import type { Task, Folder, Workspace, WorkSession } from "@/types";
import { completeRecurringTask } from "@/lib/utils";
import { loadState, type PersistedState } from "@/lib/storage";

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
  | { type: "SET_TASK_ORDER"; ids: string[] }
  | { type: "RESET_RECURRING"; id: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "ADD_FOLDER"; folder: Folder }
  | { type: "RENAME_FOLDER"; id: string; name: string }
  | { type: "DELETE_FOLDER"; id: string }
  | { type: "ENSURE_WORKSPACE"; taskId: string; workspace: Workspace }
  | { type: "UPDATE_WORKSPACE"; id: string; updates: Partial<Workspace> }
  | { type: "ADD_SESSION"; workspaceId: string; session: WorkSession }
  | { type: "APPLY_OPTIMIZATION"; taskId: string; field: string; value: unknown }
  | { type: "SET_GCAL"; connected: boolean }
  | { type: "REPLACE_ALL"; state: DataState };

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

    case "SET_TASK_ORDER": {
      // Reorder a subset (a list or All-section) within the global array, keeping
      // every other task in its existing slot. `ids` is the subset's new order.
      const idSet = new Set(action.ids);
      const ordered = action.ids
        .map(id => state.tasks.find(t => t.id === id))
        .filter((t): t is Task => !!t);
      let k = 0;
      const arr = state.tasks.map(t => (idSet.has(t.id) ? ordered[k++] : t));
      return { ...state, tasks: arr };
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

    case "REPLACE_ALL":
      return action.state;

    default:
      return state;
  }
}

export function initDataState(): DataState {
  return loadState() ?? { tasks: [], folders: [], workspaces: [], gcalConnected: false };
}
