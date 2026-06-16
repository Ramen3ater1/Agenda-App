import type { Task, Folder, Workspace } from "@/types";

export interface PersistedState {
  tasks: Task[];
  folders: Folder[];
  workspaces: Workspace[];
  gcalConnected: boolean;
}

export interface PersistedTimer {
  workspaceId: string | null;
  running: boolean;
  accumulated: number;
  startedAt: number | null;
}

const STATE_KEY = "agenda:v1";
const TIMER_KEY = "agenda:timer:v1";

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.folders) || !Array.isArray(parsed.workspaces)) {
      return null;
    }
    return parsed as PersistedState;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / unavailable */
  }
}

export function loadTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.running !== "boolean") return null;
    return parsed as PersistedTimer;
  } catch {
    return null;
  }
}

export function saveTimer(timer: PersistedTimer): void {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch {
    /* ignore */
  }
}
