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

    addTask: (title: string, opts?: Partial<Omit<Task, "id" | "title">>) => {
      const t = title.trim();
      if (!t) return;
      dispatch({
        type: "ADD_TASK",
        task: {
          id: uid(), title: t,
          description: opts?.description ?? "",
          priority:    opts?.priority ?? "medium",
          status:      opts?.status ?? "todo",
          deadline:    opts?.deadline ?? todayISO(),
          steps:       opts?.steps ?? [],
          folderId:    opts?.folderId,
          workspaceId: opts?.workspaceId,
          recurrence:  opts?.recurrence ?? "none",
        },
      });
    },

    updateTask: (id: string, updates: Partial<Task>) => {
      const task = findTask(id);
      let next = updates;
      if (updates.steps && task && task.status !== "done" && updates.steps.some(s => s.done)) {
        next = { ...updates, status: "in-progress" };
      }
      dispatch({ type: "UPDATE_TASK", id, updates: next });
      if (next.status === "done") {
        const t = findTask(id);
        if (t) handleCompletionSideEffects(t);
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

    startFocus: (task: Task) => {
      timer.start(ensureWorkspace(task));
      if (task.status === "todo") {
        dispatch({ type: "UPDATE_TASK", id: task.id, updates: { status: "in-progress" } });
      }
    },
  };
}
