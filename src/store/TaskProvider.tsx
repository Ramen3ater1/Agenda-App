import { createContext, useContext, useEffect, useReducer, type ReactNode, type Dispatch } from "react";
import { taskReducer, initDataState, type DataState, type DataAction } from "@/store/taskReducer";
import { saveState } from "@/lib/storage";

interface TaskStore {
  state: DataState;
  dispatch: Dispatch<DataAction>;
}

const TaskContext = createContext<TaskStore | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, undefined, initDataState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return <TaskContext.Provider value={{ state, dispatch }}>{children}</TaskContext.Provider>;
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskStore must be used within TaskProvider");
  return ctx;
}
