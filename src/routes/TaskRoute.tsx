import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import TaskDetailPanel from "@/features/task-detail";
import EndSessionModal from "@/features/end-session";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useTimer } from "@/store/TimerProvider";
import { selectListTasks } from "@/lib/utils";

export default function TaskRoute() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const listKey = searchParams.get("list") ?? "all";

  const { tasks, updateTask, toggleDone, deleteTask, startFocus } = useTasks();
  const { folders } = useFolders();
  const { getWorkspace, updateWorkspace } = useWorkspaces();
  const timer = useTimer();
  const [endingWorkspaceId, setEndingWorkspaceId] = useState<string | null>(null);

  const task = tasks.find(t => t.id === taskId);

  useEffect(() => {
    if (!task) toast.error("Task not found");
  }, [task]);

  if (!task) return <Navigate to="/today" replace />;

  const workspace = getWorkspace(task.workspaceId);
  const listIds = selectListTasks(tasks, listKey).map(t => t.id);
  const idx = listIds.indexOf(task.id);
  const backTo = listKey === "calendar" ? "/calendar"
    : listKey === "all" || listKey === "today" ? `/${listKey}`
    : `/folder/${listKey}`;

  function go(toId: string) {
    navigate(`/task/${toId}?list=${listKey}`);
  }

  return (
    <>
      <TaskDetailPanel
        task={task}
        workspace={workspace}
        folders={folders}
        onBack={() => navigate(backTo)}
        onPrev={idx > 0 ? () => go(listIds[idx - 1]) : undefined}
        onNext={idx >= 0 && idx < listIds.length - 1 ? () => go(listIds[idx + 1]) : undefined}
        position={idx >= 0 ? `${idx + 1} / ${listIds.length}` : ""}
        onUpdateTask={(updates) => updateTask(task.id, updates)}
        onToggleDone={() => toggleDone(task.id)}
        onDeleteTask={() => { deleteTask(task.id); navigate(backTo); }}
        timerElapsed={timer.elapsed}
        timerRunning={timer.running}
        timerWorkspaceId={timer.workspaceId}
        onStartFocus={() => startFocus(task)}
        onPause={timer.pause}
        onRequestEnd={(wsId) => setEndingWorkspaceId(wsId)}
        onUpdateWorkspace={updateWorkspace}
      />
      {endingWorkspaceId && (
        <EndSessionModal
          elapsed={timer.elapsed}
          onSave={(comment) => { timer.end(endingWorkspaceId, comment); setEndingWorkspaceId(null); }}
          onCancel={() => setEndingWorkspaceId(null)}
        />
      )}
    </>
  );
}
