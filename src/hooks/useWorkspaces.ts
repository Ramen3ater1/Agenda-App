import { useTaskStore } from "@/store/TaskProvider";
import type { Workspace } from "@/types";

export function useWorkspaces() {
  const { state, dispatch } = useTaskStore();
  return {
    workspaces: state.workspaces,
    getWorkspace: (id?: string) => id ? state.workspaces.find(w => w.id === id) : undefined,
    updateWorkspace: (id: string, updates: Partial<Workspace>) => dispatch({ type: "UPDATE_WORKSPACE", id, updates }),
  };
}
