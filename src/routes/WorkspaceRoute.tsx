import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import WorkspacePanel from "@/features/task-workspace";
import EndSessionModal from "@/features/end-session";
import { useTasks } from "@/hooks/useTasks";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useTimer } from "@/store/TimerProvider";

export default function WorkspaceRoute() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const listKey = searchParams.get("list") ?? "all";

  const { tasks, updateTask, startFocus } = useTasks();
  const { getWorkspace, updateWorkspace } = useWorkspaces();
  const timer = useTimer();
  const [endingWorkspaceId, setEndingWorkspaceId] = useState<string | null>(null);

  const task = tasks.find(t => t.id === taskId);

  useEffect(() => {
    if (!task) toast.error("Task not found");
  }, [task]);

  if (!task) return <Navigate to="/today" replace />;

  const workspace = getWorkspace(task.workspaceId);
  const backToTask = `/task/${task.id}?list=${listKey}`;

  return (
    <>
      <WorkspacePanel
        task={task}
        workspace={workspace}
        onBack={() => navigate(backToTask)}
        onUpdateTask={(updates) => updateTask(task.id, updates)}
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
