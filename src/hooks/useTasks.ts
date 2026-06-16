import { toast } from "sonner";
import { useTaskStore } from "@/store/TaskProvider";
import { useTimer } from "@/store/TimerProvider";
import { uid, todayISO, advanceDeadline, formatDate } from "@/lib/utils";
import type { Task } from "@/types";

export function useTasks() {
  const { state, dispatch } = useTaskStore();
  const timer = useTimer();

  function findTask(id: string) {
    return state.tasks.find(t => t.id === id);
  }

  function handleCompletionSideEffects(task: Task) {
    if (timer.running && task.workspaceId && timer.workspaceId === task.workspaceId) {
      timer.end(task.workspaceId, "Task marked as done.");
    }
    if (task.recurrence !== "none") {
      setTimeout(() => {
        dispatch({ type: "RESET_RECURRING", id: task.id });
        toast.success(`Recurring task reset — next: ${formatDate(advanceDeadline(task.deadline, task.recurrence), "short")}`);
      }, 600);
    }
  }

  function ensureWorkspace(task: Task): string {
    if (task.workspaceId) return task.workspaceId;
    const id = uid();
    dispatch({ type: "ENSURE_WORKSPACE", taskId: task.id, workspace: { id, name: task.title, taskId: task.id, resources: [], sessions: [] } });
    return id;
  }

  return {
    tasks: state.tasks,
    getTask: findTask,

    addTask: (title: string, opts?: { deadline?: string; folderId?: string }) => {
      const t = title.trim();
      if (!t) return;
      dispatch({
        type: "ADD_TASK",
        task: {
          id: uid(), title: t, description: "", priority: "medium", status: "todo",
          deadline: opts?.deadline ?? todayISO(), steps: [], folderId: opts?.folderId, recurrence: "none",
        },
      });
    },

    updateTask: (id: string, updates: Partial<Task>) => {
      dispatch({ type: "UPDATE_TASK", id, updates });
      if (updates.status === "done") {
        const task = findTask(id);
        if (task) handleCompletionSideEffects(task);
      }
    },

    toggleDone: (id: string) => {
      const task = findTask(id);
      if (!task) return;
      const wasDone = task.status === "done";
      dispatch({ type: "TOGGLE_TASK", id });
      if (!wasDone) {
        handleCompletionSideEffects(task);
        if (task.recurrence === "none") toast.success("Task completed");
      }
    },

    deleteTask: (id: string) => {
      const task = findTask(id);
      if (!task) return;
      if (task.workspaceId && timer.workspaceId === task.workspaceId) timer.reset();
      dispatch({ type: "DELETE_TASK", id });
    },

    applyOptimization: (taskId: string, field: string, value: unknown) =>
      dispatch({ type: "APPLY_OPTIMIZATION", taskId, field, value }),

    startFocus: (task: Task) => timer.start(ensureWorkspace(task)),
  };
}
