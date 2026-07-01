import { toast } from "sonner";
import { useTaskStore } from "@/store/TaskProvider";
import { useTimer } from "@/store/TimerProvider";
import { useGoogleSync } from "@/store/GoogleSyncProvider";
import { uid, todayISO, advanceDeadline, formatDate } from "@/lib/utils";
import { minutesToTime } from "@/lib/timeWindow";
import type { Task } from "@/types";

// Task fields whose change should be reflected on the mirrored Google event.
const GCAL_PUSH_FIELDS: (keyof Task)[] = ["title", "description", "location", "startDate", "startTime", "durationMin", "deadline"];

// A sensible default for a freshly created task: starting ~10 minutes from now
// (snapped to 5-minute marks) so it lands on the calendar/timeline instead of
// piling up as an all-day item.
function defaultStartTime(): string {
  const now = new Date();
  const min = Math.round((now.getHours() * 60 + now.getMinutes() + 10) / 5) * 5;
  return minutesToTime(Math.min(min, 23 * 60 + 55));
}

export function useTasks() {
  const { state, dispatch } = useTaskStore();
  const timer = useTimer();
  const gcal = useGoogleSync();

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
    ensureWorkspace,

    addTask: (title: string, opts?: Partial<Omit<Task, "id" | "title">>) => {
      const t = title.trim();
      if (!t) return;
      const task: Task = {
        id: uid(), title: t,
        description: opts?.description ?? "",
        priority:    opts?.priority ?? "medium",
        status:      opts?.status ?? "todo",
        deadline:    opts?.deadline ?? todayISO(),
        steps:       opts?.steps ?? [],
        folderId:    opts?.folderId,
        workspaceId: opts?.workspaceId,
        recurrence:  opts?.recurrence ?? "none",
        startDate:   opts?.startDate ?? opts?.deadline ?? todayISO(),
        startTime:   opts?.startTime ?? defaultStartTime(),
        durationMin: opts?.durationMin ?? 60,
        location:    opts?.location,
      };
      dispatch({ type: "ADD_TASK", task });
      void gcal.upsertEvent(task); // best-effort mirror to Google Calendar
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
      if (task && GCAL_PUSH_FIELDS.some(f => f in next)) {
        void gcal.upsertEvent({ ...task, ...next });
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
      void gcal.removeEvent(id); // best-effort remove from Google Calendar
      dispatch({ type: "DELETE_TASK", id });
    },

    reorderTasks: (ids: string[]) =>
      dispatch({ type: "SET_TASK_ORDER", ids }),

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
